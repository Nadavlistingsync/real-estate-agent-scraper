const TestScraper = require('./scrapers/testScraper');
// const ZillowScraper = require('./scrapers/zillowScraper');
// const RealtorScraper = require('./scrapers/realtorScraper');
const CSVService = require('./services/csvService');
const { logger, scraperLogger, logError } = require('./utils/logger');
const { isUSAgent, cleanAgentData } = require('./utils/emailUtils');
const config = require('./config/config');

class ScraperOrchestrator {
  constructor() {
    this.csvService = new CSVService();
    this.scrapers = [
      new TestScraper()
      // new ZillowScraper(),
      // new RealtorScraper()
    ];
    this.allAgents = [];
  }

  /**
   * Run the complete scraping process
   */
  async run() {
    try {
      logger.info('Starting real estate agent scraping process');
      
      // Backup existing CSV if it exists
      await this.csvService.backupCSV();

      // Run all scrapers
      for (const scraper of this.scrapers) {
        await this.runScraper(scraper);
      }

      // Process and save results
      await this.processResults();

      // Generate final report
      await this.generateReport();

      logger.info('Scraping process completed successfully');
      return this.allAgents;

    } catch (error) {
      logError('scraper', error, { context: 'ScraperOrchestrator.run' });
      throw error;
    }
  }

  /**
   * Run a single scraper
   */
  async runScraper(scraper) {
    try {
      const scraperName = scraper.constructor.name;
      logger.info(`Starting ${scraperName}`);

      const startTime = Date.now();
      const agents = await scraper.scrape();
      const endTime = Date.now();

      const duration = Math.round((endTime - startTime) / 1000);
      logger.info(`${scraperName} completed in ${duration}s with ${agents.length} agents`);

      // Filter and clean agents
      const validAgents = agents
        .filter(agent => agent && agent.name && isUSAgent(agent))
        .map(agent => cleanAgentData(agent));

      this.allAgents.push(...validAgents);

      logger.info(`${scraperName} found ${validAgents.length} valid US agents`);

    } catch (error) {
      logError('scraper', error, { 
        context: 'ScraperOrchestrator.runScraper', 
        scraper: scraper.constructor.name 
      });
    }
  }

  /**
   * Process and save results
   */
  async processResults() {
    try {
      logger.info(`Processing ${this.allAgents.length} total agents`);

      // Remove duplicates based on email
      const uniqueAgents = this.removeDuplicates();
      logger.info(`After deduplication: ${uniqueAgents.length} unique agents`);

      // Save to CSV
      const success = await this.csvService.writeAgentsToCSV(uniqueAgents);
      
      if (success) {
        logger.info(`Successfully saved ${uniqueAgents.length} agents to CSV`);
      } else {
        throw new Error('Failed to save agents to CSV');
      }

      this.allAgents = uniqueAgents;

    } catch (error) {
      logError('scraper', error, { context: 'ScraperOrchestrator.processResults' });
      throw error;
    }
  }

  /**
   * Remove duplicate agents
   */
  removeDuplicates() {
    const uniqueAgents = [];
    const seenEmails = new Set();
    const seenNames = new Set();

    for (const agent of this.allAgents) {
      const emailKey = agent.email.toLowerCase();
      const nameKey = agent.name.toLowerCase();

      // Skip if we've seen this email or name before
      if (emailKey && seenEmails.has(emailKey)) continue;
      if (nameKey && seenNames.has(nameKey)) continue;

      if (emailKey) seenEmails.add(emailKey);
      if (nameKey) seenNames.add(nameKey);
      uniqueAgents.push(agent);
    }

    return uniqueAgents;
  }

  /**
   * Generate final report
   */
  async generateReport() {
    try {
      const stats = await this.csvService.getCSVStats();
      
      if (stats) {
        logger.info('=== SCRAPING REPORT ===');
        logger.info(`Total agents found: ${stats.total}`);
        logger.info(`Agents with emails: ${stats.withEmails}`);
        logger.info(`Agents without emails: ${stats.withoutEmails}`);
        logger.info(`Unique emails: ${stats.uniqueEmails}`);
        logger.info(`States covered: ${stats.states}`);
        logger.info(`Cities covered: ${stats.cities}`);
        logger.info('=======================');
      }

      // Log some sample agents
      const agentsWithEmails = this.allAgents.filter(agent => agent.email);
      if (agentsWithEmails.length > 0) {
        logger.info('Sample agents with emails:');
        agentsWithEmails.slice(0, 5).forEach(agent => {
          logger.info(`- ${agent.name} (${agent.email}) - ${agent.city}, ${agent.state}`);
        });
      }

    } catch (error) {
      logError('scraper', error, { context: 'ScraperOrchestrator.generateReport' });
    }
  }

  /**
   * Get scraping statistics
   */
  getStats() {
    const agentsWithEmails = this.allAgents.filter(agent => agent.email);
    const agentsWithoutEmails = this.allAgents.filter(agent => !agent.email);

    return {
      total: this.allAgents.length,
      withEmails: agentsWithEmails.length,
      withoutEmails: agentsWithoutEmails.length,
      uniqueEmails: new Set(agentsWithEmails.map(a => a.email.toLowerCase())).size,
      states: new Set(this.allAgents.map(a => a.state).filter(s => s)).size,
      cities: new Set(this.allAgents.map(a => a.city).filter(c => c)).size
    };
  }
}

// Main execution function
async function main() {
  const orchestrator = new ScraperOrchestrator();
  
  try {
    await orchestrator.run();
    
    const stats = orchestrator.getStats();
    console.log('\n=== SCRAPING COMPLETED ===');
    console.log(`Total agents: ${stats.total}`);
    console.log(`With emails: ${stats.withEmails}`);
    console.log(`Without emails: ${stats.withoutEmails}`);
    console.log(`Unique emails: ${stats.uniqueEmails}`);
    console.log(`States: ${stats.states}`);
    console.log(`Cities: ${stats.cities}`);
    console.log('==========================\n');
    
    process.exit(0);
  } catch (error) {
    logger.error('Scraping failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = ScraperOrchestrator; 