const { security } = require('../utils/security');
const { logger } = require('../utils/logger');
const db = require('../database');

// Authenticate JWT token middleware
async function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            logger.warn('No token provided');
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        try {
            // Verify token
            const decoded = security.verifyToken(token);

            // Check if token is blacklisted
            const isBlacklisted = await db.isTokenBlacklisted(token);
            if (isBlacklisted) {
                logger.warn('Blacklisted token used', { token });
                return res.status(401).json({
                    success: false,
                    error: 'Token is no longer valid'
                });
            }

            // Check if session exists and is valid
            const session = await db.getSession(token);
            if (!session) {
                logger.warn('Invalid session', { token });
                return res.status(401).json({
                    success: false,
                    error: 'Invalid session'
                });
            }

            // Get user
            const user = await db.getUser(decoded.userId);
            if (!user) {
                logger.warn('User not found', { userId: decoded.userId });
                return res.status(401).json({
                    success: false,
                    error: 'User not found'
                });
            }

            // Check if user is active
            if (!user.is_active) {
                logger.warn('Inactive user attempted access', { userId: user.id });
                return res.status(403).json({
                    success: false,
                    error: 'Account is inactive'
                });
            }

            // Update last activity
            await db.updateSessionActivity(token);

            // Attach user to request
            req.user = {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            };

            next();
        } catch (error) {
            logger.warn('Token verification failed', { error: error.message });
            return res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }
    } catch (error) {
        logger.error('Authentication error:', error);
        return res.status(500).json({
            success: false,
            error: 'Authentication failed'
        });
    }
}

// Check user role middleware
function checkRole(roles) {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                logger.warn('No user object in request');
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
            }

            const userRole = req.user.role || 'user';

            if (!roles.includes(userRole)) {
                logger.warn('Insufficient permissions', {
                    userId: req.user.id,
                    required: roles,
                    actual: userRole
                });
                return res.status(403).json({
                    success: false,
                    error: 'Insufficient permissions'
                });
            }

            next();
        } catch (error) {
            logger.error('Role check error:', error);
            return res.status(500).json({
                success: false,
                error: 'Role verification failed'
            });
        }
    };
}

// Rate limiting middleware based on user or IP
async function rateLimit(req, res, next) {
    try {
        const key = req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
        const limit = req.user ? 100 : 20; // Higher limit for authenticated users
        const window = 60 * 60; // 1 hour window

        const current = await db.getRateLimit(key);
        
        if (current && current.count >= limit) {
            logger.warn('Rate limit exceeded', {
                key,
                count: current.count,
                limit
            });
            return res.status(429).json({
                success: false,
                error: 'Too many requests',
                retryAfter: Math.ceil((current.timestamp + window * 1000 - Date.now()) / 1000)
            });
        }

        await db.incrementRateLimit(key, window);
        next();
    } catch (error) {
        logger.error('Rate limit error:', error);
        // Continue on rate limit errors
        next();
    }
}

module.exports = {
    authenticateToken,
    checkRole,
    rateLimit
}; 