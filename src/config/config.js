require('dotenv').config();

const config = {
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    secure: false
  },
  email: {
    from: process.env.FROM_EMAIL,
    fromName: process.env.FROM_NAME || 'Nadav',
    maxPerDay: parseInt(process.env.MAX_EMAILS_PER_DAY) || 50,
    delay: parseInt(process.env.EMAIL_DELAY) || 10000,
    retryAttempts: parseInt(process.env.EMAIL_RETRY_ATTEMPTS) || 3
  },
  scraping: {
    maxAgentsPerSite: parseInt(process.env.MAX_AGENTS_PER_SITE) || 100,
    delay: parseInt(process.env.SCRAPING_DELAY) || 2000,
    maxRetries: parseInt(process.env.MAX_RETRIES) || 3
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/scraper.log'
  },
  server: {
    port: parseInt(process.env.PORT) || 3000,
    env: process.env.NODE_ENV || 'development'
  }
};

// Validate required configuration
const requiredFields = [
  'smtp.user',
  'smtp.pass',
  'email.from'
];

for (const field of requiredFields) {
  const value = field.split('.').reduce((obj, key) => obj?.[key], config);
  if (!value) {
    throw new Error(`Missing required configuration: ${field}`);
  }
}

module.exports = config; 