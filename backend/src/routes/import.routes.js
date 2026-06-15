// src/routes/import.routes.js
const { Router } = require('express');
const {
  dryRun, commit, getBatch, listBatches, uploadMiddleware,
} = require('../controllers/import.controller');
const { requireAuth, optionalAuth } = require('../middleware/auth.middleware');
const router = Router();

// Phase 1: POST /api/import/dry-run — multipart CSV upload → anomaly report
// optionalAuth: allows unauthenticated dry-runs for testing, but logs userId if available
router.post('/dry-run', optionalAuth, uploadMiddleware, dryRun);

// Phase 2: POST /api/import/commit — JSON payload with batchId + user decisions
router.post('/commit', requireAuth, commit);

// GET /api/import/batches — list all import batches
router.get('/batches', requireAuth, listBatches);

// GET /api/import/batches/:batchId — get a specific batch report
router.get('/batches/:batchId', requireAuth, getBatch);

module.exports = router;
