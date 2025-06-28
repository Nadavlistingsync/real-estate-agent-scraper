const EmailService = require('./services/emailService');
const CSVService = require('./services/csvService');
const { logger, emailLogger, logError } = require('./utils/logger');

class EmailSender {
  constructor() {
    this.emailService = new EmailService();
    this.csvService = new CSVService();
  }

  /**
   * Initialize and run email sending process
   */
  async run(maxEmails = null) {
    try {
      logger.info('Starting email sending process');

      // Initialize email service
      const initialized = await this.emailService.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize email service');
      }

      // Get agents with emails from CSV
      const agents = await this.csvService.getAgentsWithEmails();
      if (agents.length === 0) {
        logger.warn('No agents with emails found in CSV');
        return { success: false, reason: 'No agents with emails' };
      }

      logger.info(`Found ${agents.length} agents with emails`);

      // Check email limits
      const emailStats = this.emailService.getEmailStats();
      logger.info('Email statistics:', emailStats);

      if (emailStats.remainingToday === 0) {
        logger.warn('Daily email limit reached');
        return { success: false, reason: 'Daily limit reached' };
      }

      // Send emails
      const result = await this.emailService.sendBulkEmails(agents, maxEmails);

      // Generate report
      await this.generateEmailReport(result);

      logger.info('Email sending process completed');
      return result;

    } catch (error) {
      logError('email', error, { context: 'EmailSender.run' });
      throw error;
    } finally {
      await this.emailService.close();
    }
  }

  /**
   * Send test email
   */
  async sendTestEmail(testEmail) {
    try {
      logger.info(`Sending test email to: ${testEmail}`);

      const initialized = await this.emailService.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize email service');
      }

      const testAgent = {
        name: 'Test Agent',
        email: testEmail,
        city: 'Test City',
        state: 'CA',
        company: 'Test Company',
        profile_url: ''
      };

      const result = await this.emailService.sendEmailToAgent(testAgent, 0);

      if (result.success) {
        logger.info('Test email sent successfully');
      } else {
        logger.error('Test email failed:', result.reason);
      }

      return result;

    } catch (error) {
      logError('email', error, { context: 'EmailSender.sendTestEmail' });
      throw error;
    } finally {
      await this.emailService.close();
    }
  }

  /**
   * Generate email report
   */
  async generateEmailReport(result) {
    try {
      logger.info('=== EMAIL SENDING REPORT ===');
      logger.info(`Total attempted: ${result.total}`);
      logger.info(`Successful: ${result.successful}`);
      logger.info(`Failed: ${result.failed}`);
      logger.info(`Success rate: ${((result.successful / result.total) * 100).toFixed(1)}%`);

      // Log failed emails
      const failedEmails = result.results
        .filter(r => !r.result.success)
        .map(r => ({ agent: r.agent.name, email: r.agent.email, reason: r.result.reason }));

      if (failedEmails.length > 0) {
        logger.info('Failed emails:');
        failedEmails.forEach(failed => {
          logger.info(`- ${failed.agent} (${failed.email}): ${failed.reason}`);
        });
      }

      // Get updated stats
      const stats = this.emailService.getEmailStats();
      logger.info('Updated email statistics:', stats);
      logger.info('============================');

    } catch (error) {
      logError('email', error, { context: 'EmailSender.generateEmailReport' });
    }
  }

  /**
   * Get email statistics
   */
  getEmailStats() {
    return this.emailService.getEmailStats();
  }

  /**
   * Reset daily email counter
   */
  resetDailyCounter() {
    this.emailService.resetDailyCounter();
    logger.info('Daily email counter reset');
  }

  /**
   * Clear email log
   */
  clearEmailLog() {
    const success = this.emailService.clearEmailLog();
    if (success) {
      logger.info('Email log cleared');
    } else {
      logger.error('Failed to clear email log');
    }
    return success;
  }
}

// Main execution function
async function main() {
  const emailSender = new EmailSender();
  
  try {
    // Check command line arguments
    const args = process.argv.slice(2);
    const maxEmails = args[0] ? parseInt(args[0]) : null;
    const testEmail = args[1];

    if (testEmail) {
      // Send test email
      await emailSender.sendTestEmail(testEmail);
    } else {
      // Send bulk emails
      const result = await emailSender.run(maxEmails);
      
      if (result.success !== false) {
        console.log('\n=== EMAIL SENDING COMPLETED ===');
        console.log(`Total: ${result.total}`);
        console.log(`Successful: ${result.successful}`);
        console.log(`Failed: ${result.failed}`);
        console.log(`Success rate: ${((result.successful / result.total) * 100).toFixed(1)}%`);
        console.log('===============================\n');
      } else {
        console.log(`Email sending failed: ${result.reason}`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('Email sending failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = EmailSender; 