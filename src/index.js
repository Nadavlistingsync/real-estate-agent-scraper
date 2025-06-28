const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const multer = require('multer');
const csvParser = require('csv-parser');

const EmailSender = require('./emailSender');
const CSVService = require('./services/csvService');
const { logger, apiLogger, logError } = require('./utils/logger');
const config = require('./config/config');

// Conditionally import scraper to handle serverless environment
let ScraperOrchestrator;
try {
  ScraperOrchestrator = require('./scraper');
} catch (error) {
  logger.warn('Scraper not available in serverless environment', { error: error.message });
  ScraperOrchestrator = null;
}

const upload = multer({ storage: multer.memoryStorage() });

class RealEstateScraperAPI {
  constructor() {
    this.app = express();
    this.scraper = ScraperOrchestrator ? new ScraperOrchestrator() : null;
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
    // Root route with API information
    this.app.get('/', (req, res) => {
      res.json({
        success: true,
        message: 'Real Estate Agent Scraper API',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        serverless: !!process.env.VERCEL,
        endpoints: {
          health: 'GET /health',
          dashboard: 'GET /dashboard',
          scrape: 'POST /api/scrape',
          email: 'POST /api/email/send',
          testEmail: 'POST /api/email/test',
          stats: {
            scraping: 'GET /api/stats/scraping',
            email: 'GET /api/stats/email'
          },
          agents: 'GET /api/agents'
        },
        documentation: 'Check README.md for detailed usage instructions'
      });
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        serverless: !!process.env.VERCEL
      });
    });

    // Scraping routes
    this.app.post('/api/scrape', async (req, res) => {
      try {
        if (!this.scraper) {
          return res.status(503).json({
            success: false,
            error: 'Scraping is not available in serverless environment. Please run scraping locally and upload CSV data.',
            suggestion: 'Use the CSV upload feature or run scraping on a local machine'
          });
        }

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

    // CSV upload endpoint
    this.app.post('/api/agents/upload', upload.single('file'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ success: false, error: 'No file uploaded' });
        }
        const agents = [];
        const stream = require('stream');
        const bufferStream = new stream.PassThrough();
        bufferStream.end(req.file.buffer);
        bufferStream.pipe(csvParser())
          .on('data', (row) => {
            agents.push(row);
          })
          .on('end', async () => {
            await this.csvService.addAgents(agents);
            res.json({ success: true, message: 'Agents uploaded successfully', count: agents.length });
          })
          .on('error', (error) => {
            res.status(500).json({ success: false, error: error.message });
          });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Dashboard route
    this.app.get('/dashboard', (req, res) => {
      const isServerless = !!process.env.VERCEL;
      const scraperAvailable = !!this.scraper;
      
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Real Estate Scraper Dashboard</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
                .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                h1 { color: #2c3e50; text-align: center; margin-bottom: 30px; }
                .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
                .stat-card { background: #ecf0f1; padding: 20px; border-radius: 8px; text-align: center; }
                .stat-number { font-size: 2em; font-weight: bold; color: #3498db; }
                .stat-label { color: #7f8c8d; margin-top: 5px; }
                .button { background: #3498db; color: white; padding: 12px 24px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
                .button:hover { background: #2980b9; }
                .button.danger { background: #e74c3c; }
                .button.danger:hover { background: #c0392b; }
                .button.success { background: #27ae60; }
                .button.success:hover { background: #229954; }
                .button:disabled { background: #bdc3c7; cursor: not-allowed; }
                .log { background: #2c3e50; color: #ecf0f1; padding: 15px; border-radius: 5px; font-family: monospace; height: 200px; overflow-y: auto; margin-top: 20px; }
                .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
                .status.success { background: #d5f4e6; color: #27ae60; }
                .status.error { background: #fadbd8; color: #e74c3c; }
                .status.warning { background: #fef9e7; color: #f39c12; }
                .environment-info { background: #e8f4fd; padding: 15px; border-radius: 5px; margin-bottom: 20px; text-align: center; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🏠 Real Estate Agent Scraper Dashboard</h1>
                
                ${isServerless ? `
                <div class="environment-info">
                    <strong>🌐 Serverless Environment Detected</strong><br>
                    ${scraperAvailable ? '✅ Scraping available' : '⚠️ Scraping not available in serverless mode'}
                    <br><small>Upload CSV data or run scraping locally</small>
                </div>
                ` : ''}
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-number" id="totalAgents">-</div>
                        <div class="stat-label">Total Agents</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="agentsWithEmails">-</div>
                        <div class="stat-label">With Emails</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="emailsSent">-</div>
                        <div class="stat-label">Emails Sent Today</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="remainingEmails">-</div>
                        <div class="stat-label">Remaining Today</div>
                    </div>
                </div>

                <div style="text-align: center; margin: 20px 0;">
                    <button class="button success" onclick="startScraping()" ${!scraperAvailable ? 'disabled' : ''}>🚀 Start Scraping</button>
                    <button class="button" onclick="sendEmails()">📧 Send Emails</button>
                    <button class="button" onclick="refreshStats()">🔄 Refresh Stats</button>
                </div>

                <div id="status"></div>
                <div class="log" id="log">Dashboard loaded. Click buttons to interact with the scraper...</div>

                <form id="uploadForm" enctype="multipart/form-data" style="margin-bottom:20px;text-align:center;">
                  <input type="file" name="file" accept=".csv" required />
                  <button class="button" type="submit">⬆️ Upload Agents CSV</button>
                </form>
            </div>

            <script>
                async function refreshStats() {
                    try {
                        const [scrapingStats, emailStats] = await Promise.all([
                            fetch('/api/stats/scraping').then(r => r.json()),
                            fetch('/api/stats/email').then(r => r.json())
                        ]);

                        if (scrapingStats.success) {
                            document.getElementById('totalAgents').textContent = scrapingStats.stats.total || 0;
                            document.getElementById('agentsWithEmails').textContent = scrapingStats.stats.withEmails || 0;
                        }

                        if (emailStats.success) {
                            document.getElementById('emailsSent').textContent = emailStats.stats.sentToday || 0;
                            document.getElementById('remainingEmails').textContent = emailStats.stats.remainingToday || 0;
                        }

                        log('Stats refreshed successfully');
                    } catch (error) {
                        log('Error refreshing stats: ' + error.message, 'error');
                    }
                }

                async function startScraping() {
                    try {
                        log('Starting scraping...');
                        const response = await fetch('/api/scrape', { method: 'POST' });
                        const result = await response.json();
                        
                        if (result.success) {
                            log('Scraping completed: ' + result.agentsCount + ' agents found');
                            showStatus('Scraping completed successfully!', 'success');
                        } else {
                            log('Scraping failed: ' + result.error, 'error');
                            showStatus('Scraping failed: ' + result.error, 'error');
                        }
                        
                        refreshStats();
                    } catch (error) {
                        log('Error starting scraping: ' + error.message, 'error');
                        showStatus('Error starting scraping', 'error');
                    }
                }

                async function sendEmails() {
                    try {
                        log('Sending emails...');
                        const response = await fetch('/api/email/send', { method: 'POST' });
                        const result = await response.json();
                        
                        if (result.success) {
                            log('Emails sent successfully');
                            showStatus('Emails sent successfully!', 'success');
                        } else {
                            log('Email sending failed: ' + result.message, 'error');
                            showStatus('Email sending failed: ' + result.message, 'error');
                        }
                        
                        refreshStats();
                    } catch (error) {
                        log('Error sending emails: ' + error.message, 'error');
                        showStatus('Error sending emails', 'error');
                    }
                }

                document.getElementById('uploadForm').addEventListener('submit', async function(e) {
                  e.preventDefault();
                  const formData = new FormData(this);
                  log('Uploading agents...');
                  const response = await fetch('/api/agents/upload', {
                    method: 'POST',
                    body: formData
                  });
                  const result = await response.json();
                  if (result.success) {
                    log('Agents uploaded: ' + result.count, 'success');
                    showStatus('Agents uploaded successfully!', 'success');
                    refreshStats();
                  } else {
                    log('Upload failed: ' + result.error, 'error');
                    showStatus('Upload failed: ' + result.error, 'error');
                  }
                });

                function log(message, type = 'info') {
                    const logDiv = document.getElementById('log');
                    const timestamp = new Date().toLocaleTimeString();
                    const color = type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#3498db';
                    logDiv.innerHTML += \`<div style="color: \${color}">[\${timestamp}] \${message}</div>\`;
                    logDiv.scrollTop = logDiv.scrollHeight;
                }

                function showStatus(message, type) {
                    const statusDiv = document.getElementById('status');
                    statusDiv.innerHTML = \`<div class="status \${type}">\${message}</div>\`;
                    setTimeout(() => statusDiv.innerHTML = '', 5000);
                }

                // Load initial stats
                refreshStats();
            </script>
        </body>
        </html>
      `);
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
    const port = process.env.PORT || config.server.port;
    this.app.listen(port, () => {
      logger.info(`Real Estate Scraper API started on port ${port}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Serverless: ${!!process.env.VERCEL}`);
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