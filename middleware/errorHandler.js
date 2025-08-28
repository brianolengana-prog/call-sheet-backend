/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error
  let error = {
    message: err.message || 'Internal Server Error',
    status: err.status || 500,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  };

  // Stripe specific errors
  if (err.type === 'StripeCardError') {
    error = {
      message: err.message,
      status: 400,
      type: 'card_error'
    };
  } else if (err.type === 'StripeInvalidRequestError') {
    error = {
      message: err.message,
      status: 400,
      type: 'invalid_request_error'
    };
  } else if (err.type === 'StripeAPIError') {
    error = {
      message: 'Payment service error. Please try again.',
      status: 500,
      type: 'api_error'
    };
  } else if (err.type === 'StripeConnectionError') {
    error = {
      message: 'Payment service temporarily unavailable. Please try again.',
      status: 503,
      type: 'connection_error'
    };
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    error = {
      message: 'Validation failed',
      status: 400,
      details: err.details || err.message
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = {
      message: 'Invalid token',
      status: 401,
      type: 'authentication_error'
    };
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      message: 'Token expired',
      status: 401,
      type: 'authentication_error'
    };
  }

  // Database errors
  if (err.code === '23505') { // Unique constraint violation
    error = {
      message: 'Resource already exists',
      status: 409,
      type: 'duplicate_error'
    };
  }

  // Rate limit errors
  if (err.status === 429) {
    error = {
      message: 'Too many requests. Please try again later.',
      status: 429,
      type: 'rate_limit_error'
    };
  }

  // Send error response
  res.status(error.status).json({
    error: {
      message: error.message,
      type: error.type || 'server_error',
      status: error.status,
      timestamp: new Date().toISOString(),
      ...(error.details && { details: error.details }),
      ...(error.stack && { stack: error.stack })
    }
  });
};

module.exports = { errorHandler };
