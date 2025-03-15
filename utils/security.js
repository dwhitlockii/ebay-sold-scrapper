const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const xss = require('xss');
const sanitizeHtml = require('sanitize-html');
const { AppError } = require('./errorHandler');
const { logger } = require('./logger');
const helmet = require('helmet');

// Generate Content Security Policy
function generateCSP() {
    return [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self'",
        "connect-src 'self'",
        "media-src 'self'",
        "object-src 'none'",
        "frame-src 'self'",
        "worker-src 'self'",
        "frame-ancestors 'self'",
        "form-action 'self'",
        "base-uri 'self'",
        "manifest-src 'self'"
    ].join('; ');
}

// Generate Feature Policy
function generateFeaturePolicy() {
    return [
        "camera 'none'",
        "microphone 'none'",
        "geolocation 'none'",
        "payment 'none'",
        "usb 'none'",
        "vr 'none'",
        "autoplay 'none'",
        "accelerometer 'none'",
        "gyroscope 'none'",
        "magnetometer 'none'"
    ].join('; ');
}

// Configure security headers using helmet
const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': generateCSP(),
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Feature-Policy': generateFeaturePolicy()
};

// Generate a secure session secret if not provided in environment variables
const generateSessionSecret = () => {
    return crypto.randomBytes(32).toString('hex');
};

const sessionConfig = {
    secret: process.env.SESSION_SECRET || generateSessionSecret(),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
};

const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // 24 hours in seconds
};

const helmetConfig = {
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "'unsafe-eval'",
                "https://cdn.jsdelivr.net",
                "https://cdnjs.cloudflare.com"
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://cdn.jsdelivr.net",
                "https://cdnjs.cloudflare.com",
                "https://fonts.googleapis.com",
                "https://fonts.gstatic.com"
            ],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            fontSrc: [
                "'self'",
                "https://fonts.gstatic.com",
                "https://cdnjs.cloudflare.com"
            ],
            connectSrc: ["'self'", "https://api.ebay.com"],
            mediaSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameSrc: ["'none'"],
            scriptSrcAttr: ["'self'", "'unsafe-inline'"],
            scriptSrcElem: [
                "'self'",
                "'unsafe-inline'",
                "https://cdn.jsdelivr.net",
                "https://cdnjs.cloudflare.com"
            ],
            styleSrcElem: [
                "'self'",
                "'unsafe-inline'",
                "https://cdn.jsdelivr.net",
                "https://cdnjs.cloudflare.com",
                "https://fonts.googleapis.com"
            ]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: {
        policy: "cross-origin"
    }
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = req.body[key].trim();
            }
        });
    }
    next();
};

// SQL injection prevention middleware
const preventSqlInjection = (req, res, next) => {
    const sqlInjectionPattern = /('|"|;|--|\/\*|\*\/|xp_|sp_|exec|execute|insert|select|delete|update|drop|union|into|load_file|outfile)/i;
    
    const checkValue = (value) => {
        if (typeof value === 'string' && sqlInjectionPattern.test(value)) {
            throw new Error('Potential SQL injection detected');
        }
        return value;
    };

    const checkObject = (obj) => {
        Object.keys(obj).forEach(key => {
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                checkObject(obj[key]);
            } else {
                obj[key] = checkValue(obj[key]);
            }
        });
    };

    try {
        if (req.body) checkObject(req.body);
        if (req.query) checkObject(req.query);
        if (req.params) checkObject(req.params);
        next();
    } catch (error) {
        res.status(400).json({ error: 'Invalid input detected' });
    }
};

// Security utility functions
const security = {
    // Generate secure random string
    generateRandomString: (length = 32) => {
        return crypto.randomBytes(length).toString('hex');
    },

    // Hash password
    hashPassword: async (password) => {
        try {
            return await bcrypt.hash(password, 12);
        } catch (error) {
            logger.error('Password hashing error:', error);
            throw new Error('Failed to hash password');
        }
    },

    // Compare password
    comparePassword: async (password, hash) => {
        try {
            return await bcrypt.compare(password, hash);
        } catch (error) {
            logger.error('Password comparison error:', error);
            throw new Error('Failed to compare password');
        }
    },

    // Generate JWT token
    generateToken: (payload) => {
        try {
            return jwt.sign(payload, process.env.JWT_SECRET, {
                expiresIn: process.env.JWT_EXPIRES_IN || '1d'
            });
        } catch (error) {
            logger.error('Token generation error:', error);
            throw new Error('Failed to generate token');
        }
    },

    // Verify JWT token
    verifyToken: (token) => {
        try {
            return jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            logger.warn('Token verification failed:', error);
            throw new Error('Invalid token');
        }
    },

    // Generate refresh token
    generateRefreshToken: (payload) => {
        try {
            return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
                expiresIn: '30d'
            });
        } catch (error) {
            logger.error('Refresh token generation error:', error);
            throw new Error('Failed to generate refresh token');
        }
    },

    // Verify refresh token
    verifyRefreshToken: (token) => {
        try {
            return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        } catch (error) {
            logger.warn('Refresh token verification failed:', error);
            throw new Error('Invalid refresh token');
        }
    },

    // Generate random token
    generateRandomToken: (length = 32) => {
        return crypto.randomBytes(length).toString('hex');
    },

    // Sanitize user input
    sanitizeInput: (input) => {
        if (typeof input !== 'string') {
            return input;
        }
        return xss(input.trim());
    },

    // Sanitize HTML content
    sanitizeHtml: (content) => {
        return sanitizeHtml(content, {
            allowedTags: [
                'b', 'i', 'em', 'strong', 'a', 'p', 'br'
            ],
            allowedAttributes: {
                'a': ['href', 'target']
            }
        });
    },

    // Prevent SQL injection
    escapeSql: (input) => {
        if (typeof input !== 'string') {
            return input;
        }
        return input.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, char => {
            switch (char) {
                case "\0":
                    return "\\0";
                case "\x08":
                    return "\\b";
                case "\x09":
                    return "\\t";
                case "\x1a":
                    return "\\z";
                case "\n":
                    return "\\n";
                case "\r":
                    return "\\r";
                case "\"":
                case "'":
                case "\\":
                case "%":
                    return "\\" + char;
                default:
                    return char;
            }
        });
    },

    // Generate secure session ID
    generateSessionId: () => {
        return crypto.randomBytes(32).toString('base64');
    },

    // Hash sensitive data
    hashData: (data) => {
        return crypto.createHash('sha256').update(data).digest('hex');
    },

    // Generate Content Security Policy
    generateCSP: () => {
        return [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self'",
            "connect-src 'self'",
            "media-src 'self'",
            "object-src 'none'",
            "frame-src 'self'",
            "worker-src 'self'",
            "frame-ancestors 'self'",
            "form-action 'self'",
            "base-uri 'self'",
            "manifest-src 'self'"
        ].join('; ');
    },

    // Generate Feature Policy
    generateFeaturePolicy: () => {
        return [
            "camera 'none'",
            "microphone 'none'",
            "geolocation 'none'",
            "payment 'none'",
            "usb 'none'",
            "vr 'none'",
            "autoplay 'none'",
            "accelerometer 'none'",
            "gyroscope 'none'",
            "magnetometer 'none'"
        ].join('; ');
    }
};

module.exports = {
    securityHeaders,
    sanitizeInput,
    preventSqlInjection,
    corsOptions,
    sessionConfig,
    helmetConfig,
    security
}; 