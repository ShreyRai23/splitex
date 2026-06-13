// =============================================================================
// src/middleware/auth.middleware.js — JWT authentication guard
// =============================================================================

const jwt = require('jsonwebtoken');
const { createError } = require('./error.middleware');

/**
 * Middleware that validates the JWT in the Authorization header.
 * Attaches the decoded payload to req.user on success.
 *
 * Usage: router.get('/protected', requireAuth, handler)
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError(401, 'Missing or malformed Authorization header. Expected: Bearer <token>');
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, name, email, iat, exp }
    next();
  } catch (err) {
    // Let the error handler distinguish between expired and invalid
    throw err;
  }
}

/**
 * Optional auth — attaches user if token exists, but doesn't block if missing.
 * Used for routes that behave differently for authenticated vs anonymous users.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  try {
    const token = authHeader.split(' ')[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    req.user = null;
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
