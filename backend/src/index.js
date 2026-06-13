// =============================================================================
// src/index.js — Express application entry point
//
// Boot order:
//  1. Load env vars
//  2. Create Express app
//  3. Mount global middleware (CORS, Helmet, Morgan, body parsers)
//  4. Mount all route modules
//  5. Mount error handler (must be last)
//  6. Start listening
// =============================================================================

require('dotenv').config();
require('express-async-errors'); // patches Express so async route errors propagate to error handler

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const { errorHandler } = require('./middleware/error.middleware');

// Route modules
const authRoutes       = require('./routes/auth.routes');
const userRoutes       = require('./routes/users.routes');
const groupRoutes      = require('./routes/groups.routes');
const expenseRoutes    = require('./routes/expenses.routes');
const settlementRoutes = require('./routes/settlements.routes');
const balanceRoutes    = require('./routes/balances.routes');
const importRoutes     = require('./routes/import.routes');
const auditRoutes      = require('./routes/audit.routes');

const app = express();

// ---------------------------------------------------------------------------
// Global Middleware
// ---------------------------------------------------------------------------

// Security headers
app.use(helmet());

// CORS — in production, restrict origins to your frontend domain
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key'],
}));

// Request logging (dev = colorized, production = combined)
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// JSON body parser — 10mb limit to handle large import payloads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static uploads directory (for CSV file uploads via multer)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ---------------------------------------------------------------------------
// Health check — useful for deployment probes
// ---------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------
const API_PREFIX = '/api';

app.use(`${API_PREFIX}/auth`,        authRoutes);
app.use(`${API_PREFIX}/users`,       userRoutes);
app.use(`${API_PREFIX}/groups`,      groupRoutes);
app.use(`${API_PREFIX}/expenses`,    expenseRoutes);
app.use(`${API_PREFIX}/settlements`, settlementRoutes);
app.use(`${API_PREFIX}/balances`,    balanceRoutes);
app.use(`${API_PREFIX}/import`,      importRoutes);
app.use(`${API_PREFIX}/audit-logs`,  auditRoutes);

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// Global error handler — MUST be the last middleware
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 SpilTeX API running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💰 USD→INR rate: ₹${process.env.USD_TO_INR_RATE || 84}`);
});

module.exports = app; // exported for testing
