// =============================================================================
// src/services/csv-parser.service.js — Phase 1: CSV Parsing & Dry Run
//
// This service orchestrates the full two-tier validation pipeline:
//   Tier 1: csv-parse → raw rows → Zod format validation
//   Tier 2: anomaly-detector → business logic checks
//   Tier 3: Gemini enrichment → AI explanations for complex anomalies
//
// It returns a structured "Import Report" JSON without touching the database.
// The report is stored in ImportBatch so the user can review and then commit.
// =============================================================================

const { parse } = require('csv-parse/sync');
const prisma = require('../config/db');
const { validateCsvRow } = require('../validators/csv-row.validator');
const { detectAnomalies } = require('./anomaly-detector.service');
const { enrichAnomaliesWithAI } = require('./gemini.service');

/**
 * Parse a CSV buffer and run the full dry-run pipeline.
 * Returns the Import Report and saves a pending ImportBatch to DB.
 *
 * @param {Buffer|string} csvContent - Raw CSV file content
 * @param {number|null} committedById - User ID who triggered the import
 * @returns {Promise<Object>} Import report + batchId
 */
async function runDryRun(csvContent, committedById = null) {
  // -------------------------------------------------------------------------
  // Step 1: Parse raw CSV into row objects using csv-parse
  // We use 'columns: true' to get header-mapped objects instead of arrays.
  // 'relax_column_count: true' handles rows with extra/missing commas.
  // -------------------------------------------------------------------------
  let rawRows;
  try {
    rawRows = parse(csvContent, {
      columns: true,                 // use first row as column names
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,      // don't crash on malformed rows
      bom: true,                     // handle BOM in exported Excel files
    });
  } catch (parseErr) {
    throw new Error(`CSV parsing failed: ${parseErr.message}`);
  }

  if (!rawRows || rawRows.length === 0) {
    throw new Error('CSV file is empty or contains no data rows');
  }

  // -------------------------------------------------------------------------
  // Step 2: Tier 1 — Zod format validation on each row
  // Rows that fail Zod are flagged with PARSE_ERROR status and excluded from
  // Tier 2 processing (no point checking business logic on fundamentally broken rows).
  // -------------------------------------------------------------------------
  const tier1Results = rawRows.map((rawRow, index) => {
    const rowNumber = index + 2; // +2 because row 1 is the CSV header
    const validation = validateCsvRow(rawRow);

    if (!validation.success) {
      return {
        rowNumber,
        originalRow: rawRow,
        processedRow: null,
        status: 'PARSE_ERROR',
        anomalies: validation.errors.map((e) => ({
          id: 'T1',
          type: 'FORMAT_ERROR',
          severity: 'ERROR',
          rowNumber,
          row: rawRow,
          message: `[${e.field}] ${e.message}`,
          autoFixApplied: false,
          requiresUserDecision: true,
          suggestedAction: 'Correct the value and re-import.',
          aiContext: null,
        })),
      };
    }

    return { rowNumber, originalRow: rawRow, validatedRow: validation.data, tier1Pass: true };
  });

  // Separate clean rows for Tier 2 processing
  const tier1PassRows = tier1Results.filter((r) => r.tier1Pass);
  const tier1FailRows = tier1Results.filter((r) => !r.tier1Pass);

  // -------------------------------------------------------------------------
  // Step 3: Tier 2 — Business logic anomaly detection
  // Pass only the validated row data, not the raw strings.
  // -------------------------------------------------------------------------
  const validatedRowData = tier1PassRows.map((r) => r.validatedRow);
  const tier2Results = detectAnomalies(validatedRowData);

  // -------------------------------------------------------------------------
  // Step 4: Merge Tier 1 failures with Tier 2 results
  // -------------------------------------------------------------------------
  const allResults = [
    ...tier1FailRows,
    ...tier2Results,
  ].sort((a, b) => a.rowNumber - b.rowNumber);

  // -------------------------------------------------------------------------
  // Step 5: Gemini AI enrichment for complex anomalies
  // Collect all complex anomalies across all rows and batch-enrich them.
  // -------------------------------------------------------------------------
  const complexAnomalies = [];
  for (const result of allResults) {
    for (const anomaly of result.anomalies || []) {
      complexAnomalies.push({ ...anomaly, _resultRef: result });
    }
  }

  let enrichedAnomalies = complexAnomalies;
  if (complexAnomalies.length > 0) {
    try {
      enrichedAnomalies = await enrichAnomaliesWithAI(complexAnomalies);

      // Write AI context back into the result objects
      for (let i = 0; i < enrichedAnomalies.length; i++) {
        const enriched = enrichedAnomalies[i];
        const original = complexAnomalies[i];
        // Find the anomaly in the result and update it
        const resultRef = original._resultRef;
        const anomalyInResult = (resultRef.anomalies || []).find(
          (a) => a.type === original.type && a.rowNumber === original.rowNumber
        );
        if (anomalyInResult && enriched.aiContext) {
          anomalyInResult.aiContext = enriched.aiContext;
        }
      }
    } catch (err) {
      console.warn('[DryRun] AI enrichment failed:', err.message);
      // Don't block the dry run — AI is a bonus feature
    }
  }

  // -------------------------------------------------------------------------
  // Step 6: Build the Import Report summary
  // -------------------------------------------------------------------------
  const report = buildImportReport(allResults, rawRows.length);

  // -------------------------------------------------------------------------
  // Step 7: Persist the dry-run report as an ImportBatch record
  // This gives us the batchId the frontend needs to call /import/commit.
  // -------------------------------------------------------------------------
  const batch = await prisma.importBatch.create({
    data: {
      status: 'DRY_RUN_COMPLETE',
      reportJson: report,
      committedById: committedById || null,
    },
  });

  return {
    batchId: batch.id,
    report,
  };
}

// ---------------------------------------------------------------------------
// Build the final structured Import Report
// ---------------------------------------------------------------------------
function buildImportReport(results, totalRows) {
  const summary = {
    totalRows,
    ready: 0,
    needsReview: 0,
    blocked: 0,
    skipped: 0,
    convertToSettlement: 0,
    parseErrors: 0,
    totalAnomalies: 0,
  };

  for (const result of results) {
    switch (result.status) {
      case 'READY':                summary.ready++;              break;
      case 'NEEDS_REVIEW':         summary.needsReview++;        break;
      case 'BLOCKED':              summary.blocked++;            break;
      case 'SKIP':                 summary.skipped++;            break;
      case 'CONVERT_TO_SETTLEMENT':summary.convertToSettlement++; break;
      case 'PARSE_ERROR':          summary.parseErrors++;        break;
    }
    summary.totalAnomalies += (result.anomalies || []).length;
  }

  return {
    generatedAt: new Date().toISOString(),
    summary,
    rows: results.map((r) => ({
      rowNumber:    r.rowNumber,
      status:       r.status,
      originalRow:  r.originalRow,
      processedRow: r.processedRow || null,
      anomalies:    (r.anomalies || []).map((a) => ({
        id:                  a.id,
        type:                a.type,
        severity:            a.severity,
        message:             a.message,
        autoFixApplied:      a.autoFixApplied,
        autoFixDetail:       a.autoFixDetail,
        requiresUserDecision:a.requiresUserDecision,
        suggestedAction:     a.suggestedAction,
        aiContext:           a.aiContext,
      })),
    })),
  };
}

module.exports = { runDryRun };
