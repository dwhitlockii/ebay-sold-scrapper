const rateLimit = require('express-rate-limit');
const { AppError } = require('./errorHandler');

// Create different rate limiters for different routes
const createRateLimiter = (options = {}) => {
    const defaultOptions = {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per windowMs
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res, next, options) => {
            throw new AppError('Too many requests', 429);
        }
    };

    return rateLimit({
        ...defaultOptions,
        ...options
    });
};

// Different rate limiters for different routes
const rateLimiters = {
    // Global rate limiter
    global: createRateLimiter(),

    // API rate limiter
    api: createRateLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 50 // Limit each IP to 50 requests per windowMs
    }),

    // Auth rate limiter
    auth: createRateLimiter({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 5, // Limit each IP to 5 failed attempts per hour
        message: 'Too many login attempts, please try again later.'
    }),

    // Search rate limiter
    search: createRateLimiter({
        windowMs: 60 * 1000, // 1 minute
        max: 10, // Limit each IP to 10 searches per minute
        message: 'Too many search requests, please try again later.'
    }),

    // Wishlist rate limiter
    wishlist: createRateLimiter({
        windowMs: 60 * 1000, // 1 minute
        max: 20 // Limit each IP to 20 wishlist operations per minute
    })
};

// Dynamic rate limiter based on user role
const dynamicRateLimiter = (req, res, next) => {
    const userRole = req.user ? req.user.role : 'anonymous';
    const limits = {
        admin: 1000,
        premium: 500,
        user: 100,
        anonymous: 50
    };

    const limiter = createRateLimiter({
        max: limits[userRole] || limits.anonymous
    });

    return limiter(req, res, next);
};

// IP-based rate limiter with sliding window
const slidingWindowRateLimiter = (windowMs = 60000, maxRequests = 100) => {
    const requests = new Map();

    return (req, res, next) => {
        const now = Date.now();
        const ip = req.ip;

        if (!requests.has(ip)) {
            requests.set(ip, []);
        }

        const userRequests = requests.get(ip);
        const windowStart = now - windowMs;

        // Remove old requests outside the window
        while (userRequests.length > 0 && userRequests[0] < windowStart) {
            userRequests.shift();
        }

        if (userRequests.length >= maxRequests) {
            throw new AppError('Too many requests', 429);
        }

        userRequests.push(now);
        next();
    };
};

// Clean up old entries periodically
setInterval(() => {
    const now = Date.now();
    requests.forEach((timestamps, ip) => {
        const windowStart = now - windowMs;
        while (timestamps.length > 0 && timestamps[0] < windowStart) {
            timestamps.shift();
        }
        if (timestamps.length === 0) {
            requests.delete(ip);
        }
    });
}, 60000); // Clean up every minute

module.exports = {
    rateLimiters,
    dynamicRateLimiter,
    slidingWindowRateLimiter
}; 