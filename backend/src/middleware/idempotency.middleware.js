// =============================================================================
// src/middleware/idempotency.middleware.js — Idempotency key deduplication
//
// Why: Network retries on expense creation could create duplicate financial
// records. The idempotency key (X-Idempotency-Key header) ensures a retried
// request returns the original response instead of creating a duplicate.
//
// Implementation: We store the key in the `expense.idempotencyKey` column.
// On retry, we look up the existing expense and return it directly.
// This is handled per-route (in the expense controller), not via a cache,
// so it's durable across server restarts.
// =============================================================================

const prisma = require('../config/db');

/**
 * Middleware that intercepts POST /expenses requests carrying an
 * X-Idempotency-Key header and short-circuits if the expense already exists.
 *
 * Attaches req.idempotencyKey for use in the controller.
 */
async function idempotencyCheck(req, res, next) {
  const key = req.headers['x-idempotency-key'];

  if (!key) {
    // No key provided — proceed without idempotency protection
    req.idempotencyKey = null;
    return next();
  }

  // Validate key format (UUID-like, max 128 chars)
  if (key.length > 128) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'X-Idempotency-Key must be ≤ 128 characters.',
    });
  }

  req.idempotencyKey = key;

  // Check if we've already processed this key
  const existing = await prisma.expense.findUnique({
    where: { idempotencyKey: key },
    include: { splits: { include: { user: true } }, paidBy: true },
  });

  if (existing) {
    // Idempotent response — return the original expense (status 200, not 201)
    return res.status(200).json({
      idempotent: true,
      message: 'Request already processed. Returning original result.',
      data: existing,
    });
  }

  next();
}

module.exports = { idempotencyCheck };
