const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const AGENTS_TABLE = 'agents';

class AgentService {
  async getAgents({ limit = 100, offset = 0, withEmails = false } = {}) {
    let query = supabase.from(AGENTS_TABLE).select('*', { count: 'exact' });
    if (withEmails) query = query.ilike('email', '%@%');
    query = query.range(offset, offset + limit - 1);
    const { data, error, count } = await query;
    if (error) throw error;
    return { agents: data, total: count };
  }

  async addAgents(agentList) {
    const { data, error } = await supabase.from(AGENTS_TABLE).insert(agentList);
    if (error) throw error;
    return data;
  }

  async clearAgents() {
    const { error } = await supabase.from(AGENTS_TABLE).delete().neq('id', 0);
    if (error) throw error;
    return true;
  }

  async removeDuplicates() {
    // This is a placeholder. You may want to implement deduplication logic in SQL or here.
    return true;
  }
}

module.exports = AgentService; 