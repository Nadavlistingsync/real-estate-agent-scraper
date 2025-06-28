const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { scraperLogger, logError } = require('../utils/logger');
const isVercel = !!process.env.VERCEL;

class CSVService {
  constructor() {
    this.csvPath = 'agents.csv';
    this.headers = [
      { id: 'name', title: 'name' },
      { id: 'email', title: 'email' },
      { id: 'city', title: 'city' },
      { id: 'state', title: 'state' },
      { id: 'company', title: 'company' },
      { id: 'profile_url', title: 'profile_url' }
    ];
  }

  /**
   * Write agents data to CSV file
   */
  async writeAgentsToCSV(agents) {
    try {
      const csvWriter = createCsvWriter({
        path: this.csvPath,
        header: this.headers,
        append: false // Overwrite existing file
      });

      await csvWriter.writeRecords(agents);
      scraperLogger.info(`Successfully wrote ${agents.length} agents to ${this.csvPath}`);
      
      return true;
    } catch (error) {
      logError('csv', error, { context: 'CSVService.writeAgentsToCSV' });
      return false;
    }
  }

  /**
   * Append agents data to existing CSV file
   */
  async appendAgentsToCSV(agents) {
    try {
      const csvWriter = createCsvWriter({
        path: this.csvPath,
        header: this.headers,
        append: true // Append to existing file
      });

      await csvWriter.writeRecords(agents);
      scraperLogger.info(`Successfully appended ${agents.length} agents to ${this.csvPath}`);
      
      return true;
    } catch (error) {
      logError('csv', error, { context: 'CSVService.appendAgentsToCSV' });
      return false;
    }
  }

  /**
   * Read agents data from CSV file
   */
  async readAgentsFromCSV() {
    try {
      if (!fs.existsSync(this.csvPath)) {
        scraperLogger.warn(`CSV file ${this.csvPath} does not exist`);
        return [];
      }

      const agents = [];
      
      return new Promise((resolve, reject) => {
        fs.createReadStream(this.csvPath)
          .pipe(csv())
          .on('data', (row) => {
            agents.push({
              name: row.name || '',
              email: row.email || '',
              city: row.city || '',
              state: row.state || '',
              company: row.company || '',
              profile_url: row.profile_url || ''
            });
          })
          .on('end', () => {
            scraperLogger.info(`Successfully read ${agents.length} agents from ${this.csvPath}`);
            resolve(agents);
          })
          .on('error', (error) => {
            logError('csv', error, { context: 'CSVService.readAgentsFromCSV' });
            reject(error);
          });
      });

    } catch (error) {
      logError('csv', error, { context: 'CSVService.readAgentsFromCSV' });
      return [];
    }
  }

  /**
   * Get agents with valid emails
   */
  async getAgentsWithEmails() {
    try {
      const agents = await this.readAgentsFromCSV();
      const agentsWithEmails = agents.filter(agent => 
        agent.email && agent.email.trim() !== ''
      );
      
      scraperLogger.info(`Found ${agentsWithEmails.length} agents with emails out of ${agents.length} total`);
      return agentsWithEmails;
    } catch (error) {
      logError('csv', error, { context: 'CSVService.getAgentsWithEmails' });
      return [];
    }
  }

  /**
   * Update agent email in CSV
   */
  async updateAgentEmail(agentName, newEmail) {
    try {
      const agents = await this.readAgentsFromCSV();
      const updated = agents.map(agent => {
        if (agent.name === agentName) {
          return { ...agent, email: newEmail };
        }
        return agent;
      });

      await this.writeAgentsToCSV(updated);
      scraperLogger.info(`Updated email for agent: ${agentName}`);
      return true;
    } catch (error) {
      logError('csv', error, { 
        context: 'CSVService.updateAgentEmail', 
        agentName 
      });
      return false;
    }
  }

  /**
   * Remove duplicate agents based on email
   */
  async removeDuplicates() {
    try {
      const agents = await this.readAgentsFromCSV();
      const uniqueAgents = [];
      const seenEmails = new Set();

      for (const agent of agents) {
        if (agent.email && !seenEmails.has(agent.email.toLowerCase())) {
          seenEmails.add(agent.email.toLowerCase());
          uniqueAgents.push(agent);
        }
      }

      if (uniqueAgents.length < agents.length) {
        await this.writeAgentsToCSV(uniqueAgents);
        scraperLogger.info(`Removed ${agents.length - uniqueAgents.length} duplicate agents`);
      }

      return uniqueAgents;
    } catch (error) {
      logError('csv', error, { context: 'CSVService.removeDuplicates' });
      return [];
    }
  }

  /**
   * Get CSV file statistics
   */
  async getCSVStats() {
    try {
      const agents = await this.readAgentsFromCSV();
      const agentsWithEmails = agents.filter(agent => agent.email && agent.email.trim() !== '');
      
      const stats = {
        total: agents.length,
        withEmails: agentsWithEmails.length,
        withoutEmails: agents.length - agentsWithEmails.length,
        uniqueEmails: new Set(agentsWithEmails.map(a => a.email.toLowerCase())).size,
        states: new Set(agents.map(a => a.state).filter(s => s)).size,
        cities: new Set(agents.map(a => a.city).filter(c => c)).size
      };

      scraperLogger.info('CSV Statistics', stats);
      return stats;
    } catch (error) {
      logError('csv', error, { context: 'CSVService.getCSVStats' });
      return null;
    }
  }

  /**
   * Backup CSV file
   */
  async backupCSV() {
    try {
      if (!fs.existsSync(this.csvPath)) {
        scraperLogger.warn(`No CSV file to backup: ${this.csvPath}`);
        return false;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `agents_backup_${timestamp}.csv`;
      
      fs.copyFileSync(this.csvPath, backupPath);
      scraperLogger.info(`CSV backed up to: ${backupPath}`);
      return true;
    } catch (error) {
      logError('csv', error, { context: 'CSVService.backupCSV' });
      return false;
    }
  }
}

module.exports = CSVService; 