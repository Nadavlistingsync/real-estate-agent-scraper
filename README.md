# 🏠 Real Estate Agent Scraper

A comprehensive Node.js application that scrapes real estate agent directories, stores data in CSV format, and sends personalized cold emails with a beautiful web dashboard for monitoring and control.

## ✨ Features

- **Multi-source Scraping**: Scrapes from Realtor.com, Zillow, and other real estate platforms
- **Email Automation**: Sends personalized cold emails with rate limiting and tracking
- **Web Dashboard**: Beautiful UI for monitoring scraping stats and email campaigns
- **CSV Management**: Automatic backup, duplicate removal, and data export
- **API Endpoints**: RESTful API for integration with other services
- **Rate Limiting**: Built-in protection against API abuse
- **Logging**: Comprehensive logging for debugging and monitoring

## 🚀 Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/Nadavlistingsync/real-estate-agent-scraper.git
   cd real-estate-agent-scraper
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your email credentials
   ```

4. **Start the application**
   ```bash
   npm start
   ```

5. **Access the dashboard**
   - Open http://localhost:3000/dashboard
   - Monitor scraping and email statistics
   - Control scraping and email campaigns

## 🌐 Deployment Options

### Option 1: Heroku (Recommended)

1. **Deploy to Heroku**
   ```bash
   # Install Heroku CLI
   heroku create your-app-name
   heroku config:set EMAIL_USER=your-email@gmail.com
   heroku config:set EMAIL_PASS=your-app-password
   heroku config:set DAILY_EMAIL_LIMIT=50
   git push heroku main
   ```

2. **Open your app**
   ```bash
   heroku open
   ```

### Option 2: Railway

1. **Connect your GitHub repository to Railway**
2. **Set environment variables in Railway dashboard**
3. **Deploy automatically on push**

### Option 3: Render

1. **Connect your GitHub repository to Render**
2. **Set environment variables in Render dashboard**
3. **Deploy automatically on push**

### Option 4: DigitalOcean App Platform

1. **Connect your GitHub repository to DigitalOcean**
2. **Set environment variables in DigitalOcean dashboard**
3. **Deploy automatically on push**

## 📧 Email Setup

1. **Enable 2-factor authentication on your Gmail account**
2. **Generate an App Password**
3. **Set environment variables:**
   - `EMAIL_USER`: Your Gmail address
   - `EMAIL_PASS`: Your Gmail app password
   - `DAILY_EMAIL_LIMIT`: Maximum emails per day (default: 50)

## 🔧 API Endpoints

### Core Endpoints
- `GET /` - Root endpoint with links
- `GET /dashboard` - Web dashboard
- `GET /health` - Health check

### Scraping Endpoints
- `POST /api/scrape` - Start scraping
- `GET /api/stats/scraping` - Get scraping statistics
- `GET /api/agents` - Get scraped agents

### Email Endpoints
- `POST /api/email/send` - Send emails
- `GET /api/stats/email` - Get email statistics
- `POST /api/email/reset` - Reset daily counter
- `POST /api/email/clear-log` - Clear email log

### Management Endpoints
- `POST /api/csv/backup` - Backup CSV data
- `POST /api/csv/remove-duplicates` - Remove duplicate agents

## 📊 Dashboard Features

- **Real-time Statistics**: View total agents, emails sent, and remaining daily limit
- **One-click Actions**: Start scraping and send emails with button clicks
- **Live Logging**: See real-time activity in the dashboard
- **Status Updates**: Get immediate feedback on operations

## 🔒 Security Features

- **Rate Limiting**: Prevents API abuse
- **CORS Protection**: Secure cross-origin requests
- **Helmet.js**: Security headers
- **Input Validation**: Sanitized inputs
- **Error Handling**: Graceful error responses

## 📁 Project Structure

```
src/
├── config/
│   └── config.js          # Configuration management
├── scrapers/
│   ├── baseScraper.js     # Base scraper class
│   ├── realtorScraper.js  # Realtor.com scraper
│   ├── zillowScraper.js   # Zillow scraper
│   └── testScraper.js     # Test scraper
├── services/
│   ├── csvService.js      # CSV operations
│   └── emailService.js    # Email operations
├── utils/
│   ├── logger.js          # Logging utility
│   └── emailUtils.js      # Email utilities
├── emailSender.js         # Email automation
├── scraper.js             # Main scraper orchestration
└── index.js               # Express server and API
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This tool is for educational and legitimate business purposes only. Please ensure compliance with:
- Website terms of service
- Email regulations (CAN-SPAM, GDPR)
- Local laws and regulations
- Rate limiting and respectful scraping practices

## 🆘 Support

For issues and questions:
1. Check the logs in the dashboard
2. Review the API documentation
3. Open an issue on GitHub
4. Check the troubleshooting section

---

**Made with ❤️ by Nadav Benedek** 