const { logger } = require('./logger');

class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message) {
        super(message, 400);
        this.name = 'ValidationError';
    }
}

class AuthenticationError extends AppError {
    constructor(message) {
        super(message, 401);
        this.name = 'AuthenticationError';
    }
}

class ForbiddenError extends AppError {
    constructor(message) {
        super(message, 403);
        this.name = 'ForbiddenError';
    }
}

class NotFoundError extends AppError {
    constructor(message) {
        super(message, 404);
        this.name = 'NotFoundError';
    }
}

function handleError(err, res) {
    // Log the error
    logger.error('Error:', {
        message: err.message,
        stack: err.stack,
        statusCode: err.statusCode
    });

    // Operational, trusted error: send message to client
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            success: false,
            error: err.message
        });
    }

    // Programming or other unknown error: don't leak error details
    return res.status(500).json({
        success: false,
        error: 'Something went wrong'
    });
}

const asyncHandler = (fn) => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
};

const errorLogger = (err, req) => {
    console.error(`[${new Date().toISOString()}] Error:`, {
        message: err.message,
        url: req.url,
        method: req.method,
        body: req.body,
        query: req.query,
        params: req.params,
        headers: req.headers,
        stack: err.stack
    });
};

module.exports = {
    AppError,
    ValidationError,
    AuthenticationError,
    ForbiddenError,
    NotFoundError,
    handleError,
    asyncHandler,
    errorLogger
}; 