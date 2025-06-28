# Real Estate Agent Scraper & Email Automation

A full-stack Node.js application that scrapes real estate agent directories and sends personalized cold emails with AI tool offers.

## Features

- **Multi-Site Scraping**: Scrapes Zillow Agent Finder and Realtor.com Agent Search
- **Email Extraction**: Automatically finds agent emails from profiles and company websites
- **US Filtering**: Only includes US-based agents
- **Personalized Emails**: Sends customized cold emails with agent's first name
- **Rate Limiting**: Respects daily email limits and includes delays
- **Retry Logic**: Handles email failures with exponential backoff
- **CSV Storage**: Stores all agent data in structured CSV format
- **Web API**: RESTful API for controlling the system
- **Comprehensive Logging**: Detailed logs for debugging and monitoring
- **CAN-SPAM Compliant**: Includes unsubscribe options

## Quick Start

### 1. Installation

```bash
# Clone the repository
git clone <repository-url>
cd real-estate-scraper

# Install dependencies
npm install
```

### 2. Configuration

Copy the example environment file and configure your settings:

```bash
cp env.example .env
```

Edit `.env` with your SMTP credentials:

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Email Configuration
FROM_EMAIL=your-email@gmail.com
FROM_NAME=Nadav

# Scraping Configuration
MAX_AGENTS_PER_SITE=100
SCRAPING_DELAY=2000
MAX_RETRIES=3

# Email Sending Configuration
MAX_EMAILS_PER_DAY=50
EMAIL_DELAY=10000
EMAIL_RETRY_ATTEMPTS=3
```

### 3. Usage

#### Run Scraping Only
```bash
npm run scrape
```

#### Send Emails Only
```bash
# Send to all agents with emails
npm run email

# Send to specific number of agents
node src/emailSender.js 25

# Send test email
node src/emailSender.js 1 your-test-email@example.com
```

#### Start Web API
```bash
npm start
```

#### Development Mode
```bash
npm run dev
```

## API Endpoints

### Scraping
- `POST /api/scrape` - Start scraping process
- `GET /api/stats/scraping` - Get scraping statistics

### Email
- `POST /api/email/send` - Send bulk emails
- `POST /api/email/test` - Send test email
- `GET /api/stats/email` - Get email statistics
- `POST /api/email/reset` - Reset daily email counter
- `POST /api/email/clear-log` - Clear email log

### Data
- `GET /api/agents` - Get agents (with pagination)
- `POST /api/csv/backup` - Backup CSV file
- `POST /api/csv/remove-duplicates` - Remove duplicate agents

### Health
- `GET /health` - Health check

## Project Structure

```
src/
├── config/
│   └── config.js          # Configuration management
├── scrapers/
│   ├── baseScraper.js     # Base scraper class
│   ├── zillowScraper.js   # Zillow agent scraper
│   └── realtorScraper.js  # Realtor.com agent scraper
├── services/
│   ├── csvService.js      # CSV file operations
│   └── emailService.js    # Email sending service
├── utils/
│   ├── logger.js          # Logging utilities
│   └── emailUtils.js      # Email utilities
├── scraper.js             # Main scraping orchestrator
├── emailSender.js         # Email sending orchestrator
└── index.js               # Web API server
```

## Email Template

The system sends personalized cold emails with the following template:

**Subject:** Can I build you a custom AI tool?

**Body:**
```
Hey [FirstName],

I run an agency where we build custom AI tools and software for real estate agents.

Give me your biggest problem and I'll build a solution for free.

If you like it, you pay. If you don't, send it back and we figure out how to make it better.

Want to try?

– Nadav

---
Reply STOP to opt out
```

## Configuration Options

### Scraping Settings
- `MAX_AGENTS_PER_SITE`: Maximum agents to scrape per site (default: 100)
- `SCRAPING_DELAY`: Delay between scraping actions in ms (default: 2000)
- `MAX_RETRIES`: Maximum retry attempts for failed operations (default: 3)

### Email Settings
- `MAX_EMAILS_PER_DAY`: Daily email limit (default: 50)
- `EMAIL_DELAY`: Delay between emails in ms (default: 10000)
- `EMAIL_RETRY_ATTEMPTS`: Email retry attempts (default: 3)

### Server Settings
- `PORT`: API server port (default: 3000)
- `NODE_ENV`: Environment (development/production)

## Logging

The system provides comprehensive logging:

- **File Logs**: Stored in `logs/` directory
- **Console Logs**: Available in development mode
- **Email Logs**: Track sent/failed emails in `logs/email_log.json`

### Log Levels
- `error`: Errors and exceptions
- `warn`: Warnings and non-critical issues
- `info`: General information and progress
- `debug`: Detailed debugging information

## Data Format

The CSV file (`agents.csv`) contains the following columns:

- `name`: Agent's full name
- `email`: Agent's email address
- `city`: Agent's city
- `state`: Agent's state
- `company`: Agent's company/brokerage
- `profile_url`: Agent's profile URL

## Security Features

- **Rate Limiting**: API rate limiting to prevent abuse
- **Input Validation**: All inputs are validated and sanitized
- **Error Handling**: Comprehensive error handling without exposing sensitive data
- **CORS**: Configurable CORS settings
- **Helmet**: Security headers via Helmet middleware

## Monitoring & Debugging

### Automatic Feedback Loop
The system includes built-in monitoring:

1. **Progress Tracking**: Real-time scraping progress
2. **Email Status**: Track sent/failed emails
3. **Error Logging**: Detailed error logs with context
4. **Statistics**: Comprehensive statistics for both scraping and emailing
5. **Health Checks**: API health monitoring

### Debugging Tips

1. **Check Logs**: Review `logs/scraper.log` for detailed information
2. **Email Logs**: Check `logs/email_log.json` for email status
3. **API Health**: Use `GET /health` to check system status
4. **Test Emails**: Use test email functionality before bulk sending
5. **Rate Limits**: Monitor daily email limits and API rate limits

## Troubleshooting

### Common Issues

1. **SMTP Authentication Failed**
   - Verify SMTP credentials in `.env`
   - Use app passwords for Gmail
   - Check firewall/network settings

2. **Scraping Fails**
   - Check internet connection
   - Verify target websites are accessible
   - Review scraping logs for specific errors

3. **Rate Limiting**
   - Respect daily email limits
   - Increase delays between requests
   - Use different IP addresses if needed

4. **Memory Issues**
   - Reduce `MAX_AGENTS_PER_SITE`
   - Increase `SCRAPING_DELAY`
   - Monitor system resources

## Legal Compliance

- **CAN-SPAM Act**: Includes unsubscribe options
- **Rate Limiting**: Respects website terms of service
- **Data Privacy**: Only collects publicly available information
- **Email Best Practices**: Follows email marketing best practices

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
1. Check the logs for error details
2. Review the troubleshooting section
3. Create an issue with detailed information
4. Include relevant log files and configuration

## Changelog

### v1.0.0
- Initial release
- Multi-site scraping (Zillow, Realtor.com)
- Email automation with personalization
- Web API for control and monitoring
- Comprehensive logging and error handling
- Rate limiting and retry logic
- CSV data storage and management 