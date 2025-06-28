const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { emailLogger, logEmailAttempt, logError } = require('../utils/logger');
const { getFirstName, generateSubject, generateEmailBody, isValidEmail } = require('../utils/emailUtils');
const config = require('../config/config');

class EmailService {
  constructor() {
    this.transporter = null;
    this.sentEmails = new Set();
    this.failedEmails = new Set();
    this.dailyCount = 0;
    this.lastResetDate = new Date().toDateString();
    this.emailLogPath = 'logs/email_log.json';
    this.loadEmailLog();
  }

  /**
   * Initialize email transporter
   */
  async initialize() {
    try {
      this.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass
        }
      });

      // Verify connection
      await this.transporter.verify();
      emailLogger.info('Email service initialized successfully');
      return true;
    } catch (error) {
      logError('email', error, { context: 'EmailService.initialize' });
      return false;
    }
  }

  /**
   * Send email to a single agent
   */
  async sendEmailToAgent(agent, subjectIndex = 0) {
    try {
      // Check daily limit
      if (!this.checkDailyLimit()) {
        emailLogger.warn('Daily email limit reached');
        return { success: false, reason: 'Daily limit reached' };
      }

      // Validate email
      if (!isValidEmail(agent.email)) {
        logEmailAttempt(agent.email, agent, 'invalid_email');
        return { success: false, reason: 'Invalid email' };
      }

      // Check if already sent
      if (this.sentEmails.has(agent.email)) {
        logEmailAttempt(agent.email, agent, 'already_sent');
        return { success: false, reason: 'Already sent' };
      }

      // Check if previously failed
      if (this.failedEmails.has(agent.email)) {
        logEmailAttempt(agent.email, agent, 'previously_failed');
        return { success: false, reason: 'Previously failed' };
      }

      // Prepare email content
      const firstName = getFirstName(agent.name);
      const subject = generateSubject(subjectIndex);
      const body = generateEmailBody(firstName);

      // Send email with retry logic
      const result = await this.sendEmailWithRetry(agent.email, subject, body, agent);

      if (result.success) {
        this.sentEmails.add(agent.email);
        this.dailyCount++;
        this.saveEmailLog();
        logEmailAttempt(agent.email, agent, 'success');
      } else {
        this.failedEmails.add(agent.email);
        this.saveEmailLog();
        logEmailAttempt(agent.email, agent, 'failed', result.error);
      }

      // Delay between emails
      await this.delay(config.email.delay);

      return result;

    } catch (error) {
      logError('email', error, { 
        context: 'EmailService.sendEmailToAgent', 
        agent: agent.name 
      });
      return { success: false, reason: 'Exception', error: error.message };
    }
  }

  /**
   * Send email with retry logic
   */
  async sendEmailWithRetry(to, subject, body, agent, attempt = 1) {
    try {
      const mailOptions = {
        from: `"${config.email.fromName}" <${config.email.from}>`,
        to: to,
        subject: subject,
        text: body,
        headers: {
          'X-Priority': '3',
          'X-MSMail-Priority': 'Normal',
          'Importance': 'normal'
        }
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      emailLogger.info(`Email sent successfully to ${to}`, {
        messageId: result.messageId,
        agent: agent.name
      });

      return { success: true, messageId: result.messageId };

    } catch (error) {
      if (attempt < config.email.retryAttempts) {
        emailLogger.warn(`Email attempt ${attempt} failed for ${to}, retrying...`, {
          error: error.message,
          agent: agent.name
        });
        
        await this.delay(5000 * attempt); // Exponential backoff
        return this.sendEmailWithRetry(to, subject, body, agent, attempt + 1);
      } else {
        logError('email', error, { 
          context: 'EmailService.sendEmailWithRetry', 
          to, 
          attempt,
          agent: agent.name
        });
        return { success: false, error: error.message };
      }
    }
  }

  /**
   * Send emails to multiple agents
   */
  async sendBulkEmails(agents, maxEmails = null) {
    try {
      const limit = maxEmails || config.email.maxPerDay;
      const agentsToEmail = agents.slice(0, limit);
      
      emailLogger.info(`Starting bulk email send to ${agentsToEmail.length} agents`);

      const results = [];
      let subjectIndex = 0;

      for (const agent of agentsToEmail) {
        const result = await this.sendEmailToAgent(agent, subjectIndex);
        results.push({ agent, result });
        
        subjectIndex = (subjectIndex + 1) % 5; // Rotate subjects
        
        // Check if we've hit the daily limit
        if (this.dailyCount >= config.email.maxPerDay) {
          emailLogger.warn('Daily email limit reached during bulk send');
          break;
        }
      }

      const successCount = results.filter(r => r.result.success).length;
      const failureCount = results.length - successCount;

      emailLogger.info(`Bulk email completed: ${successCount} successful, ${failureCount} failed`);

      return {
        total: results.length,
        successful: successCount,
        failed: failureCount,
        results
      };

    } catch (error) {
      logError('email', error, { context: 'EmailService.sendBulkEmails' });
      throw error;
    }
  }

  /**
   * Check daily email limit
   */
  checkDailyLimit() {
    const today = new Date().toDateString();
    
    // Reset counter if it's a new day
    if (today !== this.lastResetDate) {
      this.dailyCount = 0;
      this.lastResetDate = today;
    }

    return this.dailyCount < config.email.maxPerDay;
  }

  /**
   * Get email statistics
   */
  getEmailStats() {
    return {
      sentToday: this.dailyCount,
      dailyLimit: config.email.maxPerDay,
      totalSent: this.sentEmails.size,
      totalFailed: this.failedEmails.size,
      remainingToday: Math.max(0, config.email.maxPerDay - this.dailyCount)
    };
  }

  /**
   * Load email log from file
   */
  loadEmailLog() {
    try {
      if (fs.existsSync(this.emailLogPath)) {
        const data = fs.readFileSync(this.emailLogPath, 'utf8');
        const log = JSON.parse(data);
        
        this.sentEmails = new Set(log.sentEmails || []);
        this.failedEmails = new Set(log.failedEmails || []);
        this.dailyCount = log.dailyCount || 0;
        this.lastResetDate = log.lastResetDate || new Date().toDateString();
        
        emailLogger.info('Email log loaded successfully');
      }
    } catch (error) {
      logError('email', error, { context: 'EmailService.loadEmailLog' });
    }
  }

  /**
   * Save email log to file
   */
  saveEmailLog() {
    try {
      const logDir = path.dirname(this.emailLogPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const log = {
        sentEmails: Array.from(this.sentEmails),
        failedEmails: Array.from(this.failedEmails),
        dailyCount: this.dailyCount,
        lastResetDate: this.lastResetDate,
        lastUpdated: new Date().toISOString()
      };

      fs.writeFileSync(this.emailLogPath, JSON.stringify(log, null, 2));
    } catch (error) {
      logError('email', error, { context: 'EmailService.saveEmailLog' });
    }
  }

  /**
   * Clear email log
   */
  clearEmailLog() {
    try {
      this.sentEmails.clear();
      this.failedEmails.clear();
      this.dailyCount = 0;
      this.lastResetDate = new Date().toDateString();
      this.saveEmailLog();
      
      emailLogger.info('Email log cleared successfully');
      return true;
    } catch (error) {
      logError('email', error, { context: 'EmailService.clearEmailLog' });
      return false;
    }
  }

  /**
   * Reset daily counter
   */
  resetDailyCounter() {
    this.dailyCount = 0;
    this.lastResetDate = new Date().toDateString();
    this.saveEmailLog();
    emailLogger.info('Daily email counter reset');
  }

  /**
   * Delay function
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Close transporter
   */
  async close() {
    try {
      if (this.transporter) {
        await this.transporter.close();
        emailLogger.info('Email service closed successfully');
      }
    } catch (error) {
      logError('email', error, { context: 'EmailService.close' });
    }
  }
}

module.exports = EmailService; 