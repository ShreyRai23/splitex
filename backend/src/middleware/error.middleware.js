// =============================================================================
// src/middleware/error.middleware.js — Centralized error handling
//
// All thrown errors (including async errors captured by express-async-errors)
// flow here. We normalize them into a consistent JSON envelope so the frontend
// always knows what to expect.
// =============================================================================

/**
 * Centralised error handler. Must be registered LAST in the Express middleware chain.
 * Four-argument signature is required by Express to recognize it as an error handler.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Log the full error server-side for debugging
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // ---------------------------------------------------------------------------
  // Prisma-specific errors
  // ---------------------------------------------------------------------------
  if (err.code === 'P2002') {
    // Unique constraint violation (e.g., duplicate idempotency key)
    return res.status(409).json({
      error: 'Conflict',
      message: 'A record with this identifier already exists.',
      field: err.meta?.target,
    });
  }

  if (err.code === 'P2025') {
    // Record not found (e.g., update/delete on non-existent ID)
    return res.status(404).json({
      error: 'Not Found',
      message: err.meta?.cause || 'The requested record does not exist.',
    });
  }

  // ---------------------------------------------------------------------------
  // Zod validation errors
  // ---------------------------------------------------------------------------
  if (err.name === 'ZodError') {
    return res.status(422).json({
      error: 'Validation Error',
      message: 'Request data failed validation.',
      issues: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // ---------------------------------------------------------------------------
  // JWT errors
  // ---------------------------------------------------------------------------
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token.' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Unauthorized', message: 'Token expired.' });
  }

  // ---------------------------------------------------------------------------
  // Application-level errors with explicit status codes
  // ---------------------------------------------------------------------------
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      error: err.name || 'Error',
      message: err.message,
    });
  }

  // ---------------------------------------------------------------------------
  // Fallback — 500 Internal Server Error
  // ---------------------------------------------------------------------------
  return res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production'
      ? 'Something went wrong. Please try again later.'
      : err.message,
  });
}

/**
 * Helper to create structured application errors with HTTP status codes.
 * Usage: throw createError(404, 'User not found')
 */
function createError(statusCode, message, name = 'AppError') {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.name = name;
  return err;
}

module.exports = { errorHandler, createError };
