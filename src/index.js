const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { RateLimiterMemory } = require('rate-limiter-flexible');

const ScraperOrchestrator = require('./scraper');
const EmailSender = require('./emailSender');
const CSVService = require('./services/csvService');
const { logger, apiLogger, logError } = require('./utils/logger');
const config = require('./config/config');

class RealEstateScraperAPI {
  constructor() {
    this.app = express();
    this.scraper = new ScraperOrchestrator();
    this.emailSender = new EmailSender();
    this.csvService = new CSVService();
    
    this.setupMiddleware();
    this.setupRateLimiting();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors());
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Logging middleware
    this.app.use((req, res, next) => {
      apiLogger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  setupRateLimiting() {
    const rateLimiter = new RateLimiterMemory({
      keyGenerator: (req) => req.ip,
      points: 100, // Number of requests
      duration: 60, // Per 60 seconds
    });

    this.app.use(async (req, res, next) => {
      try {
        await rateLimiter.consume(req.ip);
        next();
      } catch (rejRes) {
        res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.round(rejRes.msBeforeNext / 1000)
        });
      }
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Scraping routes
    this.app.post('/api/scrape', async (req, res) => {
      try {
        logger.info('Starting scraping via API');
        const agents = await this.scraper.run();
        const stats = this.scraper.getStats();
        
        res.json({
          success: true,
          message: 'Scraping completed successfully',
          stats,
          agentsCount: agents.length
        });
      } catch (error) {
        logError('api', error, { context: 'POST /api/scrape' });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Email routes
    this.app.post('/api/email/send', async (req, res) => {
      try {
        const { maxEmails } = req.body;
        logger.info('Starting email sending via API');
        
        const result = await this.emailSender.run(maxEmails);
        
        res.json({
          success: result.success !== false,
          message: result.success !== false ? 'Emails sent successfully' : result.reason,
          result
        });
      } catch (error) {
        logError('api', error, { context: 'POST /api/email/send' });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.post('/api/email/test', async (req, res) => {
      try {
        const { email } = req.body;
        
        if (!email) {
          return res.status(400).json({
            success: false,
            error: 'Email address is required'
          });
        }

        const result = await this.emailSender.sendTestEmail(email);
        
        res.json({
          success: result.success,
          message: result.success ? 'Test email sent successfully' : result.reason,
          result
        });
      } catch (error) {
        logError('api', error, { context: 'POST /api/email/test' });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Statistics routes
    this.app.get('/api/stats/scraping', async (req, res) => {
      try {
        const stats = await this.csvService.getCSVStats();
        res.json({
          success: true,
          stats
        });
      } catch (error) {
        logError('api', error, { context: 'GET /api/stats/scraping' });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.get('/api/stats/email', (req, res) => {
      try {
        const stats = this.emailSender.getEmailStats();
        res.json({
          success: true,
          stats
        });
      } catch (error) {
        logError('api', error, { context: 'GET /api/stats/email' });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Data routes
    this.app.get('/api/agents', async (req, res) => {
      try {
        const { limit = 100, offset = 0, withEmails = false } = req.query;
        
        let agents = await this.csvService.readAgentsFromCSV();
        
        if (withEmails === 'true') {
          agents = agents.filter(agent => agent.email && agent.email.trim() !== '');
        }
        
        const paginatedAgents = agents.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
        
        res.json({
          success: true,
          agents: paginatedAgents,
          total: agents.length,
          limit: parseInt(limit),
          offset: parseInt(offset)
        });
      } catch (error) {
        logError('api', error, { context: 'GET /api/agents' });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Management routes
    this.app.post('/api/email/reset', (req, res) => {
      try {
        this.emailSender.resetDailyCounter();
        res.json({
          success: true,
          message: 'Daily email counter reset successfully'
        });
      } catch (error) {
        logError('api', error, { context: 'POST /api/email/reset' });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.post('/api/email/clear-log', (req, res) => {
      try {
        const success = this.emailSender.clearEmailLog();
        res.json({
          success,
          message: success ? 'Email log cleared successfully' : 'Failed to clear email log'
        });
      } catch (error) {
        logError('api', error, { context: 'POST /api/email/clear-log' });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.post('/api/csv/backup', async (req, res) => {
      try {
        const success = await this.csvService.backupCSV();
        res.json({
          success,
          message: success ? 'CSV backed up successfully' : 'Failed to backup CSV'
        });
      } catch (error) {
        logError('api', error, { context: 'POST /api/csv/backup' });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.post('/api/csv/remove-duplicates', async (req, res) => {
      try {
        const agents = await this.csvService.removeDuplicates();
        res.json({
          success: true,
          message: 'Duplicates removed successfully',
          agentsCount: agents.length
        });
      } catch (error) {
        logError('api', error, { context: 'POST /api/csv/remove-duplicates' });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Error handling
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    });

    this.app.use((error, req, res, next) => {
      logError('api', error, { context: 'Global error handler' });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    });
  }

  start() {
    const port = config.server.port;
    this.app.listen(port, () => {
      logger.info(`Real Estate Scraper API started on port ${port}`);
      logger.info(`Environment: ${config.server.env}`);
      logger.info(`Health check: http://localhost:${port}/health`);
    });
  }
}

// Start the API server
if (require.main === module) {
  const api = new RealEstateScraperAPI();
  api.start();
}

module.exports = RealEstateScraperAPI; 