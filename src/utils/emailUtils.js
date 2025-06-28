const axios = require('axios');
const cheerio = require('cheerio');
const { logError } = require('./logger');

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_PATTERNS = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
];

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim().toLowerCase());
};

/**
 * Extract first name from full name
 */
const getFirstName = (fullName) => {
  if (!fullName || typeof fullName !== 'string') return 'there';
  const name = fullName.trim();
  const firstName = name.split(' ')[0];
  return firstName || 'there';
};

/**
 * Extract emails from HTML content
 */
const extractEmailsFromHTML = (html) => {
  const emails = new Set();
  
  try {
    const $ = cheerio.load(html);
    
    // Find mailto links
    $('a[href^="mailto:"]').each((i, el) => {
      const href = $(el).attr('href');
      const match = href.match(/mailto:([^\s?]+)/);
      if (match && isValidEmail(match[1])) {
        emails.add(match[1].toLowerCase());
      }
    });
    
    // Find emails in text content
    const text = $.text();
    EMAIL_PATTERNS.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const email = match.replace('mailto:', '').toLowerCase();
          if (isValidEmail(email)) {
            emails.add(email);
          }
        });
      }
    });
    
  } catch (error) {
    logError('email', error, { context: 'extractEmailsFromHTML' });
  }
  
  return Array.from(emails);
};

/**
 * Crawl a website for emails
 */
const crawlForEmails = async (url, maxDepth = 2) => {
  const emails = new Set();
  const visited = new Set();
  
  const crawl = async (currentUrl, depth = 0) => {
    if (depth > maxDepth || visited.has(currentUrl)) return;
    visited.add(currentUrl);
    
    try {
      const response = await axios.get(currentUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const foundEmails = extractEmailsFromHTML(response.data);
      foundEmails.forEach(email => emails.add(email));
      
      // If we found emails, no need to go deeper
      if (foundEmails.length > 0) return;
      
      // Look for contact page links
      if (depth === 0) {
        const $ = cheerio.load(response.data);
        const contactLinks = [];
        
        $('a').each((i, el) => {
          const href = $(el).attr('href');
          const text = $(el).text().toLowerCase();
          
          if (href && (text.includes('contact') || href.includes('contact'))) {
            const fullUrl = new URL(href, currentUrl).href;
            contactLinks.push(fullUrl);
          }
        });
        
        // Crawl contact pages
        for (const contactUrl of contactLinks.slice(0, 3)) {
          await crawl(contactUrl, depth + 1);
        }
      }
      
    } catch (error) {
      logError('email', error, { 
        context: 'crawlForEmails', 
        url: currentUrl, 
        depth 
      });
    }
  };
  
  await crawl(url);
  return Array.from(emails);
};

/**
 * Generate email subject with rotation
 */
const generateSubject = (index = 0) => {
  const subjects = [
    'Can I build you a custom AI tool?',
    'Free AI tool for your real estate business?',
    'Want a custom AI solution for your agency?',
    'AI automation for real estate agents',
    'Custom software for your real estate business?'
  ];
  
  return subjects[index % subjects.length];
};

/**
 * Generate email body with personalization
 */
const generateEmailBody = (firstName) => {
  return `Hey ${firstName},

I run an agency where we build custom AI tools and software for real estate agents.

Give me your biggest problem and I'll build a solution for free.

If you like it, you pay. If you don't, send it back and we figure out how to make it better.

Want to try?

– Nadav

---
Reply STOP to opt out`;
};

/**
 * Clean and normalize agent data
 */
const cleanAgentData = (agent) => {
  return {
    name: agent.name?.trim() || '',
    email: agent.email?.trim().toLowerCase() || '',
    city: agent.city?.trim() || '',
    state: agent.state?.trim() || '',
    company: agent.company?.trim() || '',
    profile_url: agent.profile_url?.trim() || ''
  };
};

/**
 * Filter US-based agents
 */
const isUSAgent = (agent) => {
  const usStates = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ];
  
  const state = agent.state?.toUpperCase().trim();
  return usStates.includes(state);
};

module.exports = {
  isValidEmail,
  getFirstName,
  extractEmailsFromHTML,
  crawlForEmails,
  generateSubject,
  generateEmailBody,
  cleanAgentData,
  isUSAgent
}; 