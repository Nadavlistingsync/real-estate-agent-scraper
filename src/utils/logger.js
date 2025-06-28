const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

// Ensure logs directory exists
const logsDir = path.dirname(config.logging.file);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log(`[logger] Created logs directory at: ${logsDir}`);
} else {
  console.log(`[logger] Logs directory already exists at: ${logsDir}`);
}

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: config.logging.level,
  format: fileFormat,
  transports: [
    // File transport for all logs
    new winston.transports.File({
      filename: config.logging.file,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Separate file for errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add console transport in development
if (config.server.env === 'development') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Create specialized loggers
const scraperLogger = logger.child({ module: 'scraper' });
const emailLogger = logger.child({ module: 'email' });
const apiLogger = logger.child({ module: 'api' });

// Helper functions for common logging patterns
const logScrapingProgress = (site, current, total, agent) => {
  scraperLogger.info(`Scraping progress: ${site}`, {
    current,
    total,
    agent: agent?.name || 'Unknown',
    progress: `${((current / total) * 100).toFixed(1)}%`
  });
};

const logEmailAttempt = (email, agent, status, error = null) => {
  emailLogger.info(`Email attempt: ${status}`, {
    email,
    agent: agent?.name || 'Unknown',
    error: error?.message || null
  });
};

const logError = (module, error, context = {}) => {
  const loggerInstance = module === 'scraper' ? scraperLogger : 
                        module === 'email' ? emailLogger : 
                        apiLogger;
  
  loggerInstance.error(`Error in ${module}`, {
    error: error.message,
    stack: error.stack,
    ...context
  });
};

module.exports = {
  logger,
  scraperLogger,
  emailLogger,
  apiLogger,
  logScrapingProgress,
  logEmailAttempt,
  logError
}; 