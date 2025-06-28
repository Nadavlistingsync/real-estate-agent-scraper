const AgentService = require('./agentService');

class CSVService {
  constructor() {
    this.agentService = new AgentService();
  }

  async getAgentsWithEmails() {
    const { agents } = await this.agentService.getAgents({ withEmails: true });
    return agents;
  }

  async readAgentsFromCSV() {
    const { agents } = await this.agentService.getAgents();
    return agents;
  }

  async addAgents(agentList) {
    return this.agentService.addAgents(agentList);
  }

  async clearAgents() {
    return this.agentService.clearAgents();
  }

  async removeDuplicates() {
    return this.agentService.removeDuplicates();
  }

  async getCSVStats() {
    const { agents, total } = await this.agentService.getAgents();
    const withEmails = agents.filter(a => a.email && a.email.trim() !== '').length;
    return { total, withEmails };
  }

  async backupCSV() {
    // No-op for Supabase
    return true;
  }
}

module.exports = CSVService; 