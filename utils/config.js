require('dotenv').config();

const config = {
    // Server configuration
    server: {
        port: process.env.PORT || 3001,
        env: process.env.NODE_ENV || 'development',
        host: process.env.HOST || 'localhost'
    },

    // Database configuration
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        name: process.env.DB_NAME || 'ebay_tracker',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        maxConnections: process.env.DB_MAX_CONNECTIONS || 20,
        idleTimeoutMillis: process.env.DB_IDLE_TIMEOUT || 30000
    },

    // Authentication configuration
    auth: {
        jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
        sessionSecret: process.env.SESSION_SECRET || 'session-secret-key',
        refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
        saltRounds: parseInt(process.env.SALT_ROUNDS) || 12
    },

    // API configuration
    api: {
        ebayApiKey: process.env.EBAY_API_KEY,
        ebayApiSecret: process.env.EBAY_API_SECRET,
        ebayEndpoint: process.env.EBAY_API_ENDPOINT || 'https://api.ebay.com/buy/browse/v1',
        maxRequestsPerMinute: parseInt(process.env.MAX_REQUESTS_PER_MINUTE) || 100
    },

    // Security configuration
    security: {
        allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'],
        maxFileSize: process.env.MAX_FILE_SIZE || '10mb',
        rateLimits: {
            windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
            max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
        }
    },

    // Logging configuration
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'combined',
        directory: process.env.LOG_DIRECTORY || 'logs'
    },

    // Cache configuration
    cache: {
        enabled: process.env.CACHE_ENABLED === 'true',
        ttl: parseInt(process.env.CACHE_TTL) || 3600, // 1 hour
        maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 100 // MB
    },

    // Email configuration
    email: {
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        },
        from: process.env.EMAIL_FROM || 'noreply@ebaytracker.com'
    },

    // Feature flags
    features: {
        enableWishlist: process.env.ENABLE_WISHLIST !== 'false',
        enablePriceAlerts: process.env.ENABLE_PRICE_ALERTS !== 'false',
        enableHistoricalData: process.env.ENABLE_HISTORICAL_DATA !== 'false',
        enableEmailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true'
    },

    // Validation configuration
    validation: {
        passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH) || 8,
        passwordMaxLength: parseInt(process.env.PASSWORD_MAX_LENGTH) || 128,
        usernameMinLength: parseInt(process.env.USERNAME_MIN_LENGTH) || 3,
        usernameMaxLength: parseInt(process.env.USERNAME_MAX_LENGTH) || 50
    }
};

// Validate required configuration
const validateConfig = () => {
    const requiredVars = [
        'auth.jwtSecret',
        'auth.sessionSecret',
        'api.ebayApiKey',
        'api.ebayApiSecret'
    ];

    const missingVars = requiredVars.filter(path => {
        const value = path.split('.').reduce((obj, key) => obj && obj[key], config);
        return !value || value.includes('your-secret-key');
    });

    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
};

// Freeze the configuration object to prevent modifications
Object.freeze(config);

module.exports = {
    config,
    validateConfig
}; 