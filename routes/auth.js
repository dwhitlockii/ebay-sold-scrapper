const express = require('express');
const router = express.Router();
const { validate, validations } = require('../utils/validator');
const { security } = require('../utils/security');
const { logger } = require('../utils/logger');
const db = require('../database');

// Register new user
router.post('/register', validate(validations.auth.register), async (req, res) => {
    try {
        const { username, email, password, firstName, lastName } = req.body;
        
        // Hash password
        const hashedPassword = await security.hashPassword(password);
        
        // Create user
        const { id, verificationToken } = await db.createUser({
            username,
            email,
            password: hashedPassword,
            firstName,
            lastName
        });

        // Generate tokens
        const accessToken = security.generateToken({ userId: id });
        const refreshToken = await db.createRefreshToken(id);

        logger.info('User registered successfully', { userId: id });

        res.status(201).json({
            success: true,
            accessToken,
            refreshToken,
            verificationToken
        });
    } catch (error) {
        logger.error('Registration error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Login user
router.post('/login', validate(validations.auth.login), async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Get user
        const user = await db.getUserByEmail(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Check if account is locked
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            return res.status(403).json({
                success: false,
                error: 'Account is temporarily locked. Please try again later.'
            });
        }

        // Verify password
        const isValid = await security.comparePassword(password, user.password);
        if (!isValid) {
            // Increment login attempts
            await db.updateLoginAttempts(user.id, (user.login_attempts || 0) + 1);
            
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Reset login attempts on successful login
        if (user.login_attempts > 0) {
            await db.updateLoginAttempts(user.id, 0);
        }

        // Generate tokens
        const accessToken = security.generateToken({ userId: user.id });
        const refreshToken = await db.createRefreshToken(user.id);

        // Create session
        await db.createSession(
            user.id,
            accessToken,
            req.ip,
            req.headers['user-agent']
        );

        logger.info('User logged in successfully', { userId: user.id });

        res.json({
            success: true,
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'An error occurred during login'
        });
    }
});

// Refresh token
router.post('/refresh-token', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                error: 'Refresh token is required'
            });
        }

        // Validate refresh token
        const tokenData = await db.validateRefreshToken(refreshToken);
        if (!tokenData) {
            return res.status(401).json({
                success: false,
                error: 'Invalid refresh token'
            });
        }

        // Generate new access token
        const accessToken = security.generateToken({ userId: tokenData.user_id });

        res.json({
            success: true,
            accessToken
        });
    } catch (error) {
        logger.error('Refresh token error:', error);
        res.status(500).json({
            success: false,
            error: 'An error occurred while refreshing token'
        });
    }
});

// Logout
router.post('/logout', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            await db.invalidateSession(token);
        }

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        logger.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'An error occurred during logout'
        });
    }
});

// Verify email
router.get('/verify/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const verified = await db.verifyEmail(token);

        if (!verified) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired verification token'
            });
        }

        res.json({
            success: true,
            message: 'Email verified successfully'
        });
    } catch (error) {
        logger.error('Email verification error:', error);
        res.status(500).json({
            success: false,
            error: 'An error occurred during email verification'
        });
    }
});

// Request password reset
router.post('/forgot-password', validate(validations.auth.login), async (req, res) => {
    try {
        const { email } = req.body;
        const resetToken = await db.setResetPasswordToken(email);

        if (!resetToken) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // TODO: Send reset password email
        logger.info('Password reset requested', { email });

        res.json({
            success: true,
            message: 'Password reset instructions sent to email'
        });
    } catch (error) {
        logger.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            error: 'An error occurred while processing your request'
        });
    }
});

// Reset password
router.post('/reset-password/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        const user = await db.getUserByResetToken(token);
        if (!user) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired reset token'
            });
        }

        // Hash new password
        const hashedPassword = await security.hashPassword(password);
        await db.updatePassword(user.id, hashedPassword);

        // Invalidate all sessions
        await db.invalidateAllUserSessions(user.id);

        logger.info('Password reset successful', { userId: user.id });

        res.json({
            success: true,
            message: 'Password reset successful'
        });
    } catch (error) {
        logger.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            error: 'An error occurred while resetting password'
        });
    }
});

module.exports = router; 