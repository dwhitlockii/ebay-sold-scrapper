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
const { body, validationResult } = require('express-validator');
const db = require('./database');
const { saveEbayResults } = require('./database');
const settings = require('./settings');
const crypto = require('crypto');
const { logger, stream } = require('./utils/logger');
const { sessionConfig, corsOptions, helmetConfig, sanitizeInput, preventSqlInjection } = require('./utils/security');
const { handleError } = require('./utils/errorHandler');
const morgan = require('morgan');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const session = require('express-session');

// Route imports
const authRoutes = require('./routes/auth');
const searchRoutes = require('./routes/search');
const wishlistRoutes = require('./routes/wishlist');
const ebayRoutes = require('./src/routes/ebay');
const analyticsRoutes = require('./routes/analytics');
const amazonRoutes = require('./routes/amazon');

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

// ... existing code

// Enhanced security headers
app.use(helmet(helmetConfig));

// Enable compression
app.use(compression());

// Add HTTP request logging
app.use(morgan('combined', { stream }));

// Favicon handler
app.get('/favicon.ico', (req, res) => {
    res.status(204).end();
});

// Body parser with size limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Session middleware with proper configuration
app.use(session(sessionConfig));

// Enhanced CORS configuration
app.use(cors(corsOptions));

// Input sanitization
app.use(sanitizeInput);

// SQL injection prevention
app.use(preventSqlInjection);

// Serve static files with caching
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1h',
    etag: true,
    lastModified: true
}));

// Global rate limiter
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

// API specific rate limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: 'Too many API requests from this IP, please try again later.'
});

// Apply rate limiting
app.use('/', globalLimiter);
app.use('/api/', apiLimiter);

// Input validation middleware
const validateSearch = [
    body('query').trim().notEmpty().withMessage('Search query is required')
        .isLength({ min: 2, max: 100 }).withMessage('Search query must be between 2 and 100 characters')
        .escape(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

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

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/ebay', ebayRoutes);
app.use('/api/amazon', amazonRoutes);
app.use('/api/analytics', analyticsRoutes);

// Settings routes
app.get('/api/settings/ratelimit', (req, res) => {
    try {
        const rateLimitSettings = settings.getRateLimitSettings();
        res.json({
            success: true,
            settings: rateLimitSettings
        });
    } catch (error) {
        logger.error('Error getting rate limit settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get rate limit settings'
        });
    }
});

app.post('/api/settings/ratelimit', async (req, res) => {
    try {
        await settings.updateRateLimit(req.body);
        res.json({
            success: true,
            message: 'Rate limit settings updated successfully'
        });
    } catch (error) {
        logger.error('Error updating rate limit settings:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update rate limit settings'
        });
    }
});

app.get('/api/settings/proxy', (req, res) => {
    try {
        const proxySettings = settings.getProxySettings();
        res.json({
            success: true,
            settings: proxySettings
        });
    } catch (error) {
        logger.error('Error getting proxy settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get proxy settings'
        });
    }
});

app.post('/api/settings/proxy', async (req, res) => {
    try {
        await settings.updateProxy(req.body);
        res.json({
            success: true,
            message: 'Proxy settings updated successfully'
        });
    } catch (error) {
        logger.error('Error updating proxy settings:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update proxy settings'
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Root route handler
app.get('/', (req, res) => {
    try {
        res.json({
            name: 'eBay Sold Items Scraper API',
            version: '1.0.0',
            description: 'API for tracking and analyzing eBay sold items data',
            endpoints: {
                auth: '/api/auth',
                search: '/api/search',
                settings: '/api/settings',
                health: '/health'
            }
        });
    } catch (error) {
        handleError(error, res);
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found on this server'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    handleError(err, res);
});

// Start server with graceful shutdown
const server = app.listen(process.env.PORT || 3001, () => {
    logger.info(`Server started`, {
        port: process.env.PORT || 3001,
        nodeEnv: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        logger.info('Server closed');
        db.close();
        process.exit(0);
    });
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    server.close(() => {
        process.exit(1);
    });
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection:', reason);
    server.close(() => {
        process.exit(1);
    });
});

module.exports = app;