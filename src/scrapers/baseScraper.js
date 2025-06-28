const puppeteer = require('puppeteer');
const { scraperLogger, logError } = require('../utils/logger');
const config = require('../config/config');

class BaseScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.agents = [];
  }

  async initialize() {
    try {
      this.browser = await puppeteer.launch({
        headless: "new", // Use new headless mode
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-field-trial-config',
          '--disable-ipc-flooding-protection',
          '--disable-hang-monitor',
          '--disable-prompt-on-repost',
          '--disable-client-side-phishing-detection',
          '--disable-component-extensions-with-background-pages',
          '--disable-default-apps',
          '--disable-extensions',
          '--disable-sync',
          '--disable-translate',
          '--hide-scrollbars',
          '--mute-audio',
          '--no-default-browser-check',
          '--safebrowsing-disable-auto-update',
          '--disable-blink-features=AutomationControlled'
        ]
      });

      this.page = await this.browser.newPage();
      
      // Set user agent to a more realistic one
      await this.page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Set viewport
      await this.page.setViewport({ width: 1920, height: 1080 });

      // Set extra headers to appear more human-like
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      });

      // Disable webdriver property
      await this.page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });

      // Enable request interception for better performance
      await this.page.setRequestInterception(true);
      this.page.on('request', (req) => {
        if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Handle page errors gracefully
      this.page.on('error', (err) => {
        scraperLogger.warn('Page error:', err.message);
      });

      this.page.on('pageerror', (err) => {
        scraperLogger.warn('Page error:', err.message);
      });

      scraperLogger.info('Browser initialized successfully');
    } catch (error) {
      logError('scraper', error, { context: 'BaseScraper.initialize' });
      throw error;
    }
  }

  async navigateToPage(url, waitForSelector = null) {
    try {
      scraperLogger.info(`Navigating to: ${url}`);
      
      // Set longer timeout and more robust navigation
      await this.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // Wait for network to be idle
      await this.page.waitForTimeout(3000);

      if (waitForSelector) {
        try {
          await this.page.waitForSelector(waitForSelector, { timeout: 15000 });
        } catch (error) {
          scraperLogger.warn(`Selector ${waitForSelector} not found, continuing anyway`);
        }
      }

      // Random delay to avoid detection
      await this.randomDelay(2000, 5000);
      
    } catch (error) {
      logError('scraper', error, { 
        context: 'BaseScraper.navigateToPage', 
        url 
      });
      throw error;
    }
  }

  async randomDelay(min = 2000, max = 5000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async scrollToBottom() {
    try {
      await this.page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });
    } catch (error) {
      logError('scraper', error, { context: 'BaseScraper.scrollToBottom' });
    }
  }

  async waitForElement(selector, timeout = 15000) {
    try {
      await this.page.waitForSelector(selector, { timeout });
      return true;
    } catch (error) {
      scraperLogger.warn(`Element not found: ${selector}`);
      return false;
    }
  }

  async extractText(selector) {
    try {
      return await this.page.$eval(selector, el => el.textContent?.trim() || '');
    } catch (error) {
      return '';
    }
  }

  async extractAttribute(selector, attribute) {
    try {
      return await this.page.$eval(selector, (el, attr) => el.getAttribute(attr) || '', attribute);
    } catch (error) {
      return '';
    }
  }

  async extractMultiple(selector) {
    try {
      return await this.page.$$eval(selector, elements => 
        elements.map(el => el.textContent?.trim() || '')
      );
    } catch (error) {
      return [];
    }
  }

  async extractMultipleAttributes(selector, attribute) {
    try {
      return await this.page.$$eval(selector, (elements, attr) => 
        elements.map(el => el.getAttribute(attr) || ''), attribute
      );
    } catch (error) {
      return [];
    }
  }

  async clickElement(selector) {
    try {
      await this.page.click(selector);
      await this.randomDelay(1000, 2000);
    } catch (error) {
      logError('scraper', error, { 
        context: 'BaseScraper.clickElement', 
        selector 
      });
      throw error;
    }
  }

  async typeText(selector, text) {
    try {
      await this.page.type(selector, text, { delay: 100 });
    } catch (error) {
      logError('scraper', error, { 
        context: 'BaseScraper.typeText', 
        selector 
      });
      throw error;
    }
  }

  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        scraperLogger.info('Browser closed successfully');
      }
    } catch (error) {
      logError('scraper', error, { context: 'BaseScraper.close' });
    }
  }

  // Abstract methods to be implemented by child classes
  async scrape() {
    throw new Error('scrape() method must be implemented by child class');
  }

  async getAgents() {
    throw new Error('getAgents() method must be implemented by child class');
  }
}

module.exports = BaseScraper; 