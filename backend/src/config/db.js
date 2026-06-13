// =============================================================================
// src/config/db.js — Prisma Client singleton
//
// Why singleton? Prisma's connection pool is expensive. Creating a new
// PrismaClient per request would exhaust MySQL connections. One instance
// reused across the entire process is the standard pattern.
// =============================================================================

const { PrismaClient } = require('@prisma/client');

// In development, attach the singleton to `global` to survive hot-reloads
// (nodemon re-requires modules but does NOT reset the global object).
// In production, just create it once — the process doesn't hot-reload.
const prisma =
  global.__prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV === 'development') {
  global.__prisma = prisma;
}

module.exports = prisma;
