// Load environment variables first
require('dotenv').config();

const express = require('express');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const db = require('./database');
const { saveEbayResults } = require('./database');
const settings = require('./settings');
const crypto = require('crypto');
const authRoutes = require('./routes/auth');
const searchRoutes = require('./routes/search');
const { logger, stream } = require('./utils/logger');
const morgan = require('morgan');
const fs = require('fs');

// Add this near the top of the file after the imports
const DEBUG = process.env.DEBUG === 'true';

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Initialize the database
logger.info('Initializing database');
db.initDatabase();

const app = express();

// Add HTTP request logging
app.use(morgan('combined', { stream }));

app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Secret key for JWT
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'your_refresh_secret_key';

// Middleware to protect routes
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const session = db.validateSession(token);
    if (!session) {
      return res.status(403).json({ error: "Session expired or invalid" });
    }

    req.user = {
      id: session.user_id,
      username: session.username,
      email: session.email,
      role: session.role
    };
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(403).json({ error: "Invalid token" });
  }
}

// Create a dynamic rate limiter
function createRateLimiter() {
    const rateLimitSettings = settings.getRateLimitSettings();
    return rateLimit({
        windowMs: rateLimitSettings.windowMs,
        max: rateLimitSettings.maxRequests
    });
}

// Settings routes
app.get('/api/settings/ratelimit', (req, res) => {
    res.json(settings.getRateLimitSettings());
});

app.post('/api/settings/ratelimit', async (req, res) => {
    try {
        await settings.updateRateLimit(req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/settings/proxy', (req, res) => {
    res.json(settings.getProxySettings());
});

app.post('/api/settings/proxy', async (req, res) => {
    try {
        await settings.updateProxy(req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Apply rate limiting to API routes
app.use('/api/', createRateLimiter());

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);

// Use proxy in API calls
async function makeRequest(url) {
    const proxy = settings.getNextProxy();
    if (proxy) {
        // Use the proxy for the request
        const agent = new HttpsProxyAgent(proxy);
        return await axios.get(url, { httpsAgent: agent });
    }
    return await axios.get(url);
}

// Add array of rotating user agents
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/92.0.902.73',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 11; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Mobile Safari/537.36'
];

// Add proxy support
const proxies = [
  'http://proxy1.example.com:8080',
  'http://proxy2.example.com:8080',
  'http://proxy3.example.com:8080',
  'http://proxy4.example.com:8080',
  'http://proxy5.example.com:8080'
].map(proxy => ({
  host: proxy.split('://')[1].split(':')[0],
  port: proxy.split(':')[2],
  protocol: proxy.split('://')[0]
}));

// Simple in-memory cache
const cache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Historical data endpoint
app.get('/api/history/:query', async (req, res) => {
  try {
    const query = req.params.query;

    if (DEBUG) {
      console.log('\n=== Historical Data Debug ===');
      console.log('Query:', query);
    }

    // Get eBay history
    const ebayHistory = await db.getEbayHistory(query);

    if (DEBUG) {
      console.log('\n--- eBay History ---');
      console.log('eBay Search URL:', `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`);
      console.log('Executing query for:', query);
      console.log('Executing eBay history query for:', query);
      console.log('SQL Query: \n', ebayHistory ? 'Query executed successfully' : 'No results');
      console.log('\nQuery results:', ebayHistory);
      console.log('Records found:', ebayHistory ? ebayHistory.length : 0);
      if (ebayHistory && ebayHistory.length > 0) {
        console.log('Latest record:', ebayHistory[0]);
        console.log('Oldest record:', ebayHistory[ebayHistory.length - 1]);
      }
      console.log('\nResponse summary:');
      console.log('eBay records:', ebayHistory ? ebayHistory.length : 0);
      console.log('Search URL:', `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`);
      console.log('===========================\n');
    }

    // Return the historical data
    res.json({
      success: true,
      data: ebayHistory || []
    });

  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'An error occurred while fetching history' });
  }
});

// Wishlist API Endpoints
app.get('/api/wishlist', (req, res) => {
  try {
    const wishlist = db.getWishlist();
    res.json({ wishlist });
  } catch (error) {
    console.error('Error fetching wishlist:', error.message);
    res.status(500).json({ error: "An error occurred while fetching wishlist." });
  }
});

app.post('/api/wishlist', (req, res) => {
  try {
    const { productName, targetPrice } = req.body;
    
    if (!productName) {
      return res.status(400).json({ error: "Product name is required." });
    }
    
    const id = db.addToWishlist(productName, targetPrice || null);
    res.status(201).json({ 
      success: true, 
      id, 
      message: "Item added to wishlist successfully." 
    });
  } catch (error) {
    console.error('Error adding to wishlist:', error.message);
    res.status(500).json({ error: "An error occurred while adding to wishlist." });
  }
});

app.delete('/api/wishlist/:id', (req, res) => {
  try {
    const id = req.params.id;
    const result = db.removeFromWishlist(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: "Item not found in wishlist." });
    }
    
    res.json({ 
      success: true, 
      message: "Item removed from wishlist successfully." 
    });
  } catch (error) {
    console.error('Error removing from wishlist:', error.message);
    res.status(500).json({ error: "An error occurred while removing from wishlist." });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method
    });
    
    res.status(500).json({
        success: false,
        error: 'Something went wrong! Please try again later.'
    });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    logger.info(`Server started`, {
        port: PORT,
        nodeEnv: process.env.NODE_ENV || 'development'
    });
}); 