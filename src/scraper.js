const puppeteer = require('puppeteer');
const RealtorScraper = require('./scrapers/realtorScraper');
const ZillowScraper = require('./scrapers/zillowScraper');
const TestScraper = require('./scrapers/testScraper');
const CSVService = require('./services/csvService');
const { logger, logError } = require('./utils/logger');
const config = require('./config/config');

class ScraperOrchestrator {
  constructor() {
    this.csvService = new CSVService();
    this.stats = {
      totalScraped: 0,
      totalEmails: 0,
      startTime: null,
      endTime: null,
      errors: []
    };
    
    // Check if we're in a serverless environment
    this.isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
    
    if (this.isServerless) {
      logger.warn('Running in serverless environment - scraping capabilities may be limited');
    }
  }

  async run() {
    try {
      this.stats.startTime = new Date();
      logger.info('Starting scraping orchestration');
      
      if (this.isServerless) {
        logger.warn('Serverless environment detected - using test scraper only');
        return await this.runTestScraping();
      }
      
      const agents = [];
      
      // Run scrapers in parallel for better performance
      const scraperPromises = [
        this.runRealtorScraping(),
        this.runZillowScraping()
      ];
      
      const results = await Promise.allSettled(scraperPromises);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          agents.push(...result.value);
          logger.info(`Scraper ${index + 1} completed successfully`);
        } else {
          logger.error(`Scraper ${index + 1} failed:`, result.reason);
          this.stats.errors.push(result.reason);
        }
      });
      
      // Remove duplicates
      const uniqueAgents = this.removeDuplicates(agents);
      
      // Save to Supabase
      await this.csvService.addAgents(uniqueAgents);
      
      this.stats.endTime = new Date();
      this.stats.totalScraped = uniqueAgents.length;
      this.stats.totalEmails = uniqueAgents.filter(agent => agent.email).length;
      
      logger.info(`Scraping completed. Found ${uniqueAgents.length} unique agents with ${this.stats.totalEmails} emails`);
      
      return uniqueAgents;
      
    } catch (error) {
      logError('scraper', error, { context: 'ScraperOrchestrator.run' });
      this.stats.errors.push(error.message);
      throw error;
    }
  }

  async runRealtorScraping() {
    try {
      logger.info('Starting Realtor.com scraping');
      const scraper = new RealtorScraper();
      const agents = await scraper.scrape();
      logger.info(`Realtor.com scraping completed: ${agents.length} agents found`);
      return agents;
    } catch (error) {
      logError('scraper', error, { context: 'runRealtorScraping' });
      return [];
    }
  }

  async runZillowScraping() {
    try {
      logger.info('Starting Zillow scraping');
      const scraper = new ZillowScraper();
      const agents = await scraper.scrape();
      logger.info(`Zillow scraping completed: ${agents.length} agents found`);
      return agents;
    } catch (error) {
      logError('scraper', error, { context: 'runZillowScraping' });
      return [];
    }
  }

  async runTestScraping() {
    try {
      logger.info('Starting test scraping (serverless mode)');
      const scraper = new TestScraper();
      const agents = await scraper.scrape();
      logger.info(`Test scraping completed: ${agents.length} agents found`);
      return agents;
    } catch (error) {
      logError('scraper', error, { context: 'runTestScraping' });
      return [];
    }
  }

  removeDuplicates(agents) {
    const seen = new Set();
    return agents.filter(agent => {
      const key = `${agent.email}-${agent.name}-${agent.city}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  getStats() {
    return {
      ...this.stats,
      duration: this.stats.endTime ? 
        Math.round((this.stats.endTime - this.stats.startTime) / 1000) : 0,
      errorCount: this.stats.errors.length,
      isServerless: this.isServerless
    };
  }
}

module.exports = ScraperOrchestrator; 