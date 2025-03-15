const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { db } = require('../database');
const { rateLimiter } = require('../middleware/rateLimiter');
const { logger } = require('../utils/logger');

// Registration validation middleware
const registerValidation = [
    body('firstName').trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters long'),
    body('lastName').trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters long'),
    body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters long')
        .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
    body('email').trim().isEmail().withMessage('Please enter a valid email address')
        .normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[0-9]/).withMessage('Password must contain at least one number')
        .matches(/[^a-zA-Z0-9]/).withMessage('Password must contain at least one special character'),
    body('confirmPassword').custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error('Passwords do not match');
        }
        return true;
    })
];

// Login validation middleware
const loginValidation = [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
];

// Registration endpoint
router.post('/register', rateLimiter, registerValidation, async (req, res) => {
    logger.debug('Registration attempt started', { 
        username: req.body.username,
        email: req.body.email 
    });

    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.warn('Registration validation failed', { 
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

        const { firstName, lastName, username, email, password } = req.body;

        // Check if username or email already exists
        logger.debug('Checking for existing user', { username, email });
        const stmt = db.prepare('SELECT username, email FROM users WHERE username = ? OR email = ?');
        const existingUser = stmt.get(username, email);

        if (existingUser) {
            const errors = {};
            if (existingUser.username === username) {
                errors.username = 'Username is already taken';
            }
            if (existingUser.email === email) {
                errors.email = 'Email is already registered';
            }
            logger.warn('Registration failed - user exists', { errors });
            return res.status(400).json({ success: false, errors });
        }

        // Hash password
        logger.debug('Hashing password');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert user into database
        logger.debug('Inserting new user into database');
        const insertStmt = db.prepare(`
            INSERT INTO users (
                first_name, last_name, username, email, password,
                email_verified, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
        `);
        
        const result = insertStmt.run(
            firstName, 
            lastName, 
            username, 
            email, 
            hashedPassword
        );

        logger.debug('User inserted successfully', { 
            userId: result.lastInsertRowid 
        });

        // Generate tokens
        logger.debug('Generating authentication tokens');
        const token = jwt.sign(
            { id: result.lastInsertRowid, username },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        const refreshToken = jwt.sign(
            { id: result.lastInsertRowid, username },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '30d' }
        );

        // Create session
        logger.debug('Creating user session');
        const sessionStmt = db.prepare(`
            INSERT INTO user_sessions (
                user_id, token, expires_at
            ) VALUES (?, ?, datetime('now', '+24 hours'))
        `);
        sessionStmt.run(result.lastInsertRowid, token);

        // Create refresh token record
        logger.debug('Creating refresh token');
        const refreshStmt = db.prepare(`
            INSERT INTO refresh_tokens (
                user_id, token, expires_at
            ) VALUES (?, ?, datetime('now', '+30 days'))
        `);
        refreshStmt.run(result.lastInsertRowid, refreshToken);

        logger.info('User registered successfully', { 
            userId: result.lastInsertRowid,
            username 
        });

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: {
                token,
                refreshToken,
                user: {
                    id: result.lastInsertRowid,
                    username,
                    email,
                    firstName,
                    lastName
                }
            }
        });

    } catch (error) {
        logger.error('Registration error', { 
            error: error.message,
            stack: error.stack 
        });
        res.status(500).json({
            success: false,
            error: 'An error occurred during registration. Please try again.'
        });
    }
});

// Login endpoint
router.post('/login', rateLimiter, loginValidation, async (req, res) => {
    logger.debug('Login attempt started', { 
        username: req.body.username 
    });

    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.warn('Login validation failed', { 
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

        const { username, password } = req.body;

        // Get user from database
        logger.debug('Looking up user', { username });
        const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
        const user = stmt.get(username);

        if (!user) {
            logger.warn('Login failed - user not found', { username });
            return res.status(401).json({
                success: false,
                error: 'Invalid username or password'
            });
        }

        // Check password
        logger.debug('Verifying password');
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            logger.warn('Login failed - invalid password', { 
                userId: user.id,
                username 
            });
            return res.status(401).json({
                success: false,
                error: 'Invalid username or password'
            });
        }

        // Generate tokens
        logger.debug('Generating authentication tokens');
        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        const refreshToken = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '30d' }
        );

        // Create session
        logger.debug('Creating user session');
        const sessionStmt = db.prepare(`
            INSERT INTO user_sessions (
                user_id, token, expires_at
            ) VALUES (?, ?, datetime('now', '+24 hours'))
        `);
        sessionStmt.run(user.id, token);

        // Create refresh token record
        logger.debug('Creating refresh token');
        const refreshStmt = db.prepare(`
            INSERT INTO refresh_tokens (
                user_id, token, expires_at
            ) VALUES (?, ?, datetime('now', '+30 days'))
        `);
        refreshStmt.run(user.id, refreshToken);

        // Update last login
        logger.debug('Updating last login timestamp');
        const updateStmt = db.prepare(`
            UPDATE users 
            SET last_login = datetime('now'),
                login_attempts = 0,
                locked_until = NULL
            WHERE id = ?
        `);
        updateStmt.run(user.id);

        logger.info('User logged in successfully', { 
            userId: user.id,
            username 
        });

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                refreshToken,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name
                }
            }
        });

    } catch (error) {
        logger.error('Login error', { 
            error: error.message,
            stack: error.stack 
        });
        res.status(500).json({
            success: false,
            error: 'An error occurred during login. Please try again.'
        });
    }
});

module.exports = router; 