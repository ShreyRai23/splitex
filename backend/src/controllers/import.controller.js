// =============================================================================
// src/controllers/import.controller.js — CSV Import (Phase 1 + Phase 2)
// =============================================================================

const multer = require('multer');
const path = require('path');
const { runDryRun } = require('../services/csv-parser.service');
const { commitImport } = require('../services/csv-commit.service');
const prisma = require('../config/db');
const { createError } = require('../middleware/error.middleware');
const { checkGroupMembership } = require('../middleware/authz.middleware');

// ---------------------------------------------------------------------------
// Multer configuration — memory storage (no disk I/O for dry-run)
// File is validated in-memory and discarded after the dry-run completes.
// ---------------------------------------------------------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv') {
      return cb(new Error('Only .csv files are accepted'));
    }
    cb(null, true);
  },
});

// Export the multer middleware so routes can use it
const uploadMiddleware = upload.single('file');

// ---------------------------------------------------------------------------
// Phase 1: Dry Run — parse + validate + detect anomalies (NO DB writes to expenses)
// ---------------------------------------------------------------------------
async function dryRun(req, res) {
  if (!req.file) {
    throw createError(400, 'No CSV file uploaded. Use multipart/form-data with field name "file".');
  }

  const csvContent = req.file.buffer.toString('utf-8');
  const userId = req.user?.id || null;

  const { batchId, report } = await runDryRun(csvContent, userId);

  res.status(200).json({
    message: 'Dry run complete. Review the report and call /import/commit with your decisions.',
    batchId,
    report,
  });
}

// ---------------------------------------------------------------------------
// Phase 2: Commit — write approved rows to DB in a single transaction
// ---------------------------------------------------------------------------
async function commit(req, res) {
  const { batchId, userDecisions, groupId } = req.body;

  if (!batchId) throw createError(400, 'batchId is required');
  if (!groupId) throw createError(400, 'groupId is required (which group to import into)');

  const userId = req.user?.id || null;
  if (userId) await checkGroupMembership(parseInt(groupId), userId);

  const summary = await commitImport(
    batchId,
    userDecisions || [],
    userId,
    parseInt(groupId)
  );

  res.status(200).json({
    message: 'Import committed successfully.',
    summary,
  });
}

// ---------------------------------------------------------------------------
// GET /import/batches/:batchId — retrieve a previous dry-run report
// ---------------------------------------------------------------------------
async function getBatch(req, res) {
  const { batchId } = req.params;

  const batch = await prisma.importBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw createError(404, `Import batch "${batchId}" not found`);

  if (batch.committedById && batch.committedById !== req.user?.id) {
    throw createError(403, 'You do not have access to this import batch');
  }

  res.json({ data: batch });
}

// ---------------------------------------------------------------------------
// GET /import/batches — list all import batches
// ---------------------------------------------------------------------------
async function listBatches(req, res) {
  const batches = await prisma.importBatch.findMany({
    where: { committedById: req.user?.id || null },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      status: true,
      createdAt: true,
      committedAt: true,
      committedById: true,
    },
  });
  res.json({ data: batches, count: batches.length });
}

module.exports = { dryRun, commit, getBatch, listBatches, uploadMiddleware };
