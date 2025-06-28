const BaseScraper = require('./baseScraper');
const { scraperLogger, logScrapingProgress, logError } = require('../utils/logger');
const { cleanAgentData, isUSAgent, crawlForEmails } = require('../utils/emailUtils');
const config = require('../config/config');

class ZillowScraper extends BaseScraper {
  constructor() {
    super();
    this.baseUrl = 'https://www.zillow.com/agent-finder/';
    this.agents = [];
  }

  async scrape() {
    try {
      await this.initialize();
      scraperLogger.info('Starting Zillow agent scraping');

      // Navigate to the main page
      await this.navigateToPage(this.baseUrl, '.agent-finder-container');

      // Search for agents in different cities to get variety
      const cities = [
        'New York, NY',
        'Los Angeles, CA',
        'Chicago, IL',
        'Houston, TX',
        'Phoenix, AZ',
        'Philadelphia, PA',
        'San Antonio, TX',
        'San Diego, CA',
        'Dallas, TX',
        'San Jose, CA'
      ];

      for (let i = 0; i < Math.min(cities.length, 5); i++) {
        if (this.agents.length >= config.scraping.maxAgentsPerSite) break;
        
        await this.searchAgentsInCity(cities[i]);
        await this.randomDelay(2000, 4000);
      }

      scraperLogger.info(`Zillow scraping completed. Found ${this.agents.length} agents`);
      return this.agents;

    } catch (error) {
      logError('scraper', error, { context: 'ZillowScraper.scrape' });
      throw error;
    } finally {
      await this.close();
    }
  }

  async searchAgentsInCity(city) {
    try {
      scraperLogger.info(`Searching agents in: ${city}`);

      // Try to find and fill the search input
      const searchSelectors = [
        'input[placeholder*="city"]',
        'input[placeholder*="location"]',
        'input[type="search"]',
        '.search-input',
        '[data-testid="search-input"]'
      ];

      let searchInput = null;
      for (const selector of searchSelectors) {
        searchInput = await this.page.$(selector);
        if (searchInput) break;
      }

      if (searchInput) {
        await searchInput.click();
        await this.page.keyboard.down('Control');
        await this.page.keyboard.press('KeyA');
        await this.page.keyboard.up('Control');
        await this.page.keyboard.press('Backspace');
        await this.typeText(selector, city);
        await this.page.keyboard.press('Enter');
        await this.randomDelay(2000, 4000);
      }

      // Wait for results to load
      await this.waitForElement('.agent-card, .agent-result, [data-testid="agent-card"]', 10000);

      // Extract agent information
      await this.extractAgentsFromPage();

      // Try to load more results
      await this.loadMoreResults();

    } catch (error) {
      logError('scraper', error, { 
        context: 'ZillowScraper.searchAgentsInCity', 
        city 
      });
    }
  }

  async extractAgentsFromPage() {
    try {
      // Common selectors for agent cards
      const cardSelectors = [
        '.agent-card',
        '.agent-result',
        '[data-testid="agent-card"]',
        '.agent-item',
        '.agent-listing'
      ];

      let agentCards = [];
      for (const selector of cardSelectors) {
        agentCards = await this.page.$$(selector);
        if (agentCards.length > 0) break;
      }

      scraperLogger.info(`Found ${agentCards.length} agent cards on page`);

      for (let i = 0; i < agentCards.length; i++) {
        if (this.agents.length >= config.scraping.maxAgentsPerSite) break;

        try {
          const agent = await this.extractAgentFromCard(agentCards[i]);
          if (agent && isUSAgent(agent)) {
            this.agents.push(cleanAgentData(agent));
            logScrapingProgress('Zillow', this.agents.length, config.scraping.maxAgentsPerSite, agent);
          }
        } catch (error) {
          logError('scraper', error, { 
            context: 'ZillowScraper.extractAgentFromCard', 
            cardIndex: i 
          });
        }
      }

    } catch (error) {
      logError('scraper', error, { context: 'ZillowScraper.extractAgentsFromPage' });
    }
  }

  async extractAgentFromCard(card) {
    try {
      // Extract name
      const nameSelectors = [
        '.agent-name',
        '.agent-title',
        'h3',
        'h4',
        '[data-testid="agent-name"]',
        '.name'
      ];

      let name = '';
      for (const selector of nameSelectors) {
        name = await card.$eval(selector, el => el.textContent?.trim() || '');
        if (name) break;
      }

      // Extract company/brokerage
      const companySelectors = [
        '.agent-company',
        '.brokerage',
        '.company',
        '[data-testid="agent-company"]',
        '.agency'
      ];

      let company = '';
      for (const selector of companySelectors) {
        company = await card.$eval(selector, el => el.textContent?.trim() || '');
        if (company) break;
      }

      // Extract location
      const locationSelectors = [
        '.agent-location',
        '.location',
        '[data-testid="agent-location"]',
        '.address'
      ];

      let location = '';
      for (const selector of locationSelectors) {
        location = await card.$eval(selector, el => el.textContent?.trim() || '');
        if (location) break;
      }

      // Parse city and state from location
      const locationParts = location.split(',').map(part => part.trim());
      const city = locationParts[0] || '';
      const state = locationParts[1] || '';

      // Extract profile URL
      const profileSelectors = [
        'a[href*="/profile"]',
        'a[href*="/agent"]',
        'a',
        '[data-testid="agent-link"]'
      ];

      let profileUrl = '';
      for (const selector of profileSelectors) {
        const link = await card.$(selector);
        if (link) {
          profileUrl = await link.evaluate(el => el.href || '');
          if (profileUrl && profileUrl.includes('zillow.com')) break;
        }
      }

      // Extract email if available
      let email = '';
      if (profileUrl) {
        email = await this.extractEmailFromProfile(profileUrl);
      }

      return {
        name,
        email,
        city,
        state,
        company,
        profile_url: profileUrl
      };

    } catch (error) {
      logError('scraper', error, { context: 'ZillowScraper.extractAgentFromCard' });
      return null;
    }
  }

  async extractEmailFromProfile(profileUrl) {
    try {
      // Create a new page for the profile
      const profilePage = await this.browser.newPage();
      await profilePage.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      );

      await profilePage.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 15000 });

      // Look for email in the page content
      const emailSelectors = [
        'a[href^="mailto:"]',
        '.email',
        '[data-testid="email"]',
        '.contact-email'
      ];

      let email = '';
      for (const selector of emailSelectors) {
        email = await profilePage.$eval(selector, el => {
          if (el.href && el.href.startsWith('mailto:')) {
            return el.href.replace('mailto:', '');
          }
          return el.textContent?.trim() || '';
        }).catch(() => '');
        
        if (email) break;
      }

      // If no email found, try to find company website and crawl it
      if (!email) {
        const companyLink = await profilePage.$('a[href*="http"]').catch(() => null);
        if (companyLink) {
          const companyUrl = await companyLink.evaluate(el => el.href);
          if (companyUrl && !companyUrl.includes('zillow.com')) {
            const emails = await crawlForEmails(companyUrl);
            email = emails[0] || '';
          }
        }
      }

      await profilePage.close();
      return email;

    } catch (error) {
      logError('scraper', error, { 
        context: 'ZillowScraper.extractEmailFromProfile', 
        profileUrl 
      });
      return '';
    }
  }

  async loadMoreResults() {
    try {
      // Look for "Load More" or "Show More" buttons
      const loadMoreSelectors = [
        'button:contains("Load More")',
        'button:contains("Show More")',
        '.load-more',
        '[data-testid="load-more"]',
        '.pagination-next'
      ];

      for (const selector of loadMoreSelectors) {
        const loadMoreButton = await this.page.$(selector);
        if (loadMoreButton) {
          await loadMoreButton.click();
          await this.randomDelay(2000, 4000);
          await this.extractAgentsFromPage();
          break;
        }
      }

    } catch (error) {
      logError('scraper', error, { context: 'ZillowScraper.loadMoreResults' });
    }
  }

  async getAgents() {
    return this.agents;
  }
}

module.exports = ZillowScraper; 