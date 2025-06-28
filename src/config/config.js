require('dotenv').config();

function getEnvVar(key, label) {
  if (process.env[key]) return process.env[key];
  throw new Error(`Missing required configuration: ${label} (expected env var: ${key})`);
}

const config = {
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    user: getEnvVar('EMAIL_USER', 'email.user'),
    pass: getEnvVar('EMAIL_PASS', 'email.pass'),
    from: getEnvVar('EMAIL_FROM', 'email.from'),
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
  },
  dailyEmailLimit: getEnvVar('DAILY_EMAIL_LIMIT', 'dailyEmailLimit')
};

// Validate required configuration
const requiredFields = [
  'email.from'
];

for (const field of requiredFields) {
  const value = field.split('.').reduce((obj, key) => obj?.[key], config);
  if (!value) {
    throw new Error(`Missing required configuration: ${field}`);
  }
}

console.log('Vercel ENV VARS:', Object.keys(process.env));
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '***' : undefined);
console.log('EMAIL_FROM:', process.env.EMAIL_FROM);
console.log('DAILY_EMAIL_LIMIT:', process.env.DAILY_EMAIL_LIMIT);

module.exports = config; 