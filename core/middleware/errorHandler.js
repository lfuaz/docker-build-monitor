// middleware/errorHandler.js - Global error handling middleware

/**
 * Global error handler middleware
 */
function errorHandler(err, req, res, next) {
    console.error('Error occurred:', err);
    
    // Set appropriate status code
    const statusCode = err.statusCode || 500;
    
    // Send error response
    res.status(statusCode).json({
      error: err.message || 'Internal Server Error',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
  
  module.exports = errorHandler;