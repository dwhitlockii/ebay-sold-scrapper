const { body, query, param, validationResult } = require('express-validator');
const { logger } = require('./logger');
const { security } = require('./security');

// Common validation rules
const rules = {
    // User validation rules
    username: () => 
        body('username')
            .trim()
            .isLength({ min: 3, max: 30 })
            .withMessage('Username must be between 3 and 30 characters')
            .matches(/^[a-zA-Z0-9_]+$/)
            .withMessage('Username can only contain letters, numbers, and underscores'),

    email: () =>
        body('email')
            .trim()
            .isEmail()
            .withMessage('Please enter a valid email address')
            .normalizeEmail(),

    password: () =>
        body('password')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters long')
            .matches(/[a-z]/)
            .withMessage('Password must contain at least one lowercase letter')
            .matches(/[A-Z]/)
            .withMessage('Password must contain at least one uppercase letter')
            .matches(/[0-9]/)
            .withMessage('Password must contain at least one number')
            .matches(/[^a-zA-Z0-9]/)
            .withMessage('Password must contain at least one special character'),

    confirmPassword: () =>
        body('confirmPassword')
            .custom((value, { req }) => {
                if (value !== req.body.password) {
                    throw new Error('Passwords do not match');
                }
                return true;
            }),

    // Search validation rules
    searchQuery: () =>
        query('query')
            .trim()
            .notEmpty()
            .withMessage('Search query is required')
            .isLength({ min: 2, max: 100 })
            .withMessage('Search query must be between 2 and 100 characters')
            .customSanitizer(value => security.sanitizeInput(value)),

    // Pagination validation rules
    page: () =>
        query('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer')
            .toInt(),

    limit: () =>
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100')
            .toInt(),

    // ID validation rules
    id: () =>
        param('id')
            .isInt({ min: 1 })
            .withMessage('Invalid ID')
            .toInt(),

    // Price validation rules
    price: () =>
        body('price')
            .isFloat({ min: 0.01 })
            .withMessage('Price must be greater than 0')
            .toFloat(),

    // Date validation rules
    date: () =>
        body('date')
            .optional()
            .isISO8601()
            .withMessage('Invalid date format')
            .toDate()
};

// Validation chains for different routes
const validations = {
    auth: {
        register: [
            rules.username(),
            rules.email(),
            rules.password(),
            rules.confirmPassword(),
            body('firstName')
                .trim()
                .isLength({ min: 2, max: 50 })
                .withMessage('First name must be between 2 and 50 characters'),
            body('lastName')
                .trim()
                .isLength({ min: 2, max: 50 })
                .withMessage('Last name must be between 2 and 50 characters')
        ],
        login: [
            body('email')
                .trim()
                .notEmpty()
                .withMessage('Email is required'),
            body('password')
                .notEmpty()
                .withMessage('Password is required')
        ]
    },
    search: {
        query: [
            rules.searchQuery(),
            rules.page(),
            rules.limit()
        ]
    },
    wishlist: {
        create: [
            body('searchQuery')
                .trim()
                .notEmpty()
                .withMessage('Search query is required')
                .isLength({ min: 2, max: 100 })
                .withMessage('Search query must be between 2 and 100 characters'),
            body('targetPrice')
                .optional()
                .isFloat({ min: 0.01 })
                .withMessage('Target price must be greater than 0')
                .toFloat(),
            body('notifyOnPriceBelow')
                .optional()
                .isBoolean()
                .withMessage('Notify on price below must be a boolean')
                .toBoolean()
        ],
        update: [
            rules.id(),
            body('targetPrice')
                .optional()
                .isFloat({ min: 0.01 })
                .withMessage('Target price must be greater than 0')
                .toFloat(),
            body('notifyOnPriceBelow')
                .optional()
                .isBoolean()
                .withMessage('Notify on price below must be a boolean')
                .toBoolean()
        ]
    },
    alerts: {
        create: [
            body('targetPrice')
                .isFloat({ min: 0.01 })
                .withMessage('Target price must be greater than 0')
                .toFloat(),
            body('notificationType')
                .isIn(['email', 'push', 'both'])
                .withMessage('Invalid notification type')
        ]
    }
};

// Validation middleware
function validate(validations) {
    return async (req, res, next) => {
        try {
            // Run all validations
            await Promise.all(validations.map(validation => validation.run(req)));

            // Check for validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logger.warn('Validation failed', { 
                    path: req.path,
                    errors: errors.array() 
                });

                return res.status(400).json({
                    success: false,
                    errors: errors.array().reduce((acc, error) => {
                        acc[error.param] = error.msg;
                        return acc;
                    }, {})
                });
            }

            // Sanitize request data
            if (req.body) {
                Object.keys(req.body).forEach(key => {
                    if (typeof req.body[key] === 'string') {
                        req.body[key] = security.sanitizeInput(req.body[key]);
                    }
                });
            }

            if (req.query) {
                Object.keys(req.query).forEach(key => {
                    if (typeof req.query[key] === 'string') {
                        req.query[key] = security.sanitizeInput(req.query[key]);
                    }
                });
            }

            next();
        } catch (error) {
            logger.error('Validation middleware error:', error);
            res.status(500).json({
                success: false,
                error: 'Validation failed'
            });
        }
    };
}

module.exports = {
    validate,
    validations,
    rules
}; 