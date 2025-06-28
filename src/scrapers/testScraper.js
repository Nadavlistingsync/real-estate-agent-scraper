const { scraperLogger, logError } = require('../utils/logger');
const { cleanAgentData, isUSAgent } = require('../utils/emailUtils');
const config = require('../config/config');

class TestScraper {
  constructor() {
    this.agents = [];
  }

  async scrape() {
    try {
      scraperLogger.info('Starting Test Scraper - Generating sample data');

      // Generate sample agent data
      const sampleAgents = this.generateSampleAgents();
      
      // Filter and clean agents
      const validAgents = sampleAgents
        .filter(agent => agent && agent.name && isUSAgent(agent))
        .map(agent => cleanAgentData(agent));

      this.agents = validAgents;

      scraperLogger.info(`Test Scraper completed. Generated ${this.agents.length} sample agents`);
      return this.agents;

    } catch (error) {
      logError('scraper', error, { context: 'TestScraper.scrape' });
      throw error;
    }
  }

  generateSampleAgents() {
    const sampleData = [
      {
        name: 'John Smith',
        email: 'john.smith@realtypros.com',
        city: 'New York',
        state: 'NY',
        company: 'Realty Pros',
        profile_url: 'https://example.com/john-smith'
      },
      {
        name: 'Sarah Johnson',
        email: 'sarah.johnson@century21.com',
        city: 'Los Angeles',
        state: 'CA',
        company: 'Century 21',
        profile_url: 'https://example.com/sarah-johnson'
      },
      {
        name: 'Michael Brown',
        email: 'michael.brown@kellerwilliams.com',
        city: 'Chicago',
        state: 'IL',
        company: 'Keller Williams',
        profile_url: 'https://example.com/michael-brown'
      },
      {
        name: 'Emily Davis',
        email: 'emily.davis@remax.com',
        city: 'Houston',
        state: 'TX',
        company: 'RE/MAX',
        profile_url: 'https://example.com/emily-davis'
      },
      {
        name: 'David Wilson',
        email: 'david.wilson@coldwellbanker.com',
        city: 'Phoenix',
        state: 'AZ',
        company: 'Coldwell Banker',
        profile_url: 'https://example.com/david-wilson'
      },
      {
        name: 'Lisa Anderson',
        email: 'lisa.anderson@berkshirehathaway.com',
        city: 'Philadelphia',
        state: 'PA',
        company: 'Berkshire Hathaway',
        profile_url: 'https://example.com/lisa-anderson'
      },
      {
        name: 'Robert Taylor',
        email: 'robert.taylor@windermere.com',
        city: 'San Antonio',
        state: 'TX',
        company: 'Windermere',
        profile_url: 'https://example.com/robert-taylor'
      },
      {
        name: 'Jennifer Martinez',
        email: 'jennifer.martinez@compass.com',
        city: 'San Diego',
        state: 'CA',
        company: 'Compass',
        profile_url: 'https://example.com/jennifer-martinez'
      },
      {
        name: 'Christopher Garcia',
        email: 'christopher.garcia@cbusa.com',
        city: 'Dallas',
        state: 'TX',
        company: 'CB USA',
        profile_url: 'https://example.com/christopher-garcia'
      },
      {
        name: 'Amanda Rodriguez',
        email: 'amanda.rodriguez@douglaselliman.com',
        city: 'San Jose',
        state: 'CA',
        company: 'Douglas Elliman',
        profile_url: 'https://example.com/amanda-rodriguez'
      }
    ];

    // Add some agents without emails to test filtering
    const agentsWithoutEmails = [
      {
        name: 'Thomas Lee',
        email: '',
        city: 'Miami',
        state: 'FL',
        company: 'Miami Real Estate',
        profile_url: 'https://example.com/thomas-lee'
      },
      {
        name: 'Jessica White',
        email: '',
        city: 'Seattle',
        state: 'WA',
        company: 'Seattle Properties',
        profile_url: 'https://example.com/jessica-white'
      }
    ];

    return [...sampleData, ...agentsWithoutEmails];
  }

  async getAgents() {
    return this.agents;
  }

  async close() {
    // No browser to close for test scraper
  }
}

module.exports = TestScraper; 