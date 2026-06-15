// =============================================================================
// src/services/gemini.service.js — AI anomaly context via Google Gemini
//
// This service is called during Phase 1 (CSV Dry Run) for COMPLEX anomalies.
// It generates human-readable explanations of why a row is problematic and
// what the recommended action is.
//
// Architecture decisions:
//  - Only invoked for complex anomalies (PERCENTAGE_MISMATCH, CONFLICTING_DUPLICATE,
//    ZERO_AMOUNT, AMBIGUOUS_DATE, UNKNOWN_PAYER, SPLIT_TYPE_CONFLICT).
//  - Simple format anomalies (FORMAT_FIX, ROUNDING) do NOT call Gemini.
//    Reason: Those are deterministic. Burning API quota explaining "we removed a comma"
//    is wasteful and adds latency to the dry-run.
//  - Errors from Gemini are caught gracefully. If the API is unavailable, we
//    return a fallback explanation so the import report still works.
//  - We use gemini-2.0-flash (fast, cheap) since this is a structured Q&A task,
//    not a creative generation task.
// =============================================================================

const { GoogleGenAI } = require('@google/genai');

// Lazy-initialize the client so the module can be imported without a key
// (useful for tests that mock this module)
let genai = null;

function getClient() {
  if (!genai) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return genai;
}

// ---------------------------------------------------------------------------
// Anomaly types that warrant an AI explanation (complex ones only)
// ---------------------------------------------------------------------------
const COMPLEX_ANOMALY_TYPES = new Set([
  'PERCENTAGE_MISMATCH',
  'CONFLICTING_DUPLICATE',
  'ZERO_AMOUNT',
  'AMBIGUOUS_DATE',
  'UNKNOWN_PAYER',
  'SPLIT_TYPE_CONFLICT',
  'NON_MEMBER_IN_SPLIT',
  'SETTLEMENT_DISGUISED',
]);

/**
 * Generate an AI explanation for a detected anomaly.
 *
 * @param {Object} params
 * @param {string} params.anomalyType - The anomaly code (e.g., 'PERCENTAGE_MISMATCH')
 * @param {Object} params.row - The parsed CSV row object
 * @param {number} params.rowNumber - 1-indexed row number in the CSV
 * @param {string} params.detectedIssue - Brief machine-generated description of the issue
 * @returns {Promise<{explanation: string, recommendation: string, aiGenerated: boolean}>}
 */
async function getAnomalyContext({ anomalyType, row, rowNumber, detectedIssue }) {
  // Only call AI for complex anomalies
  if (!COMPLEX_ANOMALY_TYPES.has(anomalyType)) {
    return {
      explanation: detectedIssue,
      recommendation: 'This issue was auto-corrected. No manual action required.',
      aiGenerated: false,
    };
  }

  const prompt = buildPrompt({ anomalyType, row, rowNumber, detectedIssue });

  try {
    const client = getClient();
    const model = client.models;

    const response = await model.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        maxOutputTokens: 300,
        temperature: 0.2, // low temperature for factual, deterministic output
        responseMimeType: 'application/json',
      },
    });

    const text = response.text();
    const parsed = JSON.parse(text);

    return {
      explanation: parsed.explanation || detectedIssue,
      recommendation: parsed.recommendation || 'Please review and decide manually.',
      aiGenerated: true,
    };
  } catch (err) {
    // Gemini errors must NEVER crash the import pipeline
    console.warn(`[Gemini] Failed to get AI context for ${anomalyType}: ${err.message}`);

    return {
      explanation: detectedIssue,
      recommendation: 'AI context unavailable. Please review this row manually.',
      aiGenerated: false,
      aiError: err.message,
    };
  }
}

// ---------------------------------------------------------------------------
// Prompt builder — structured prompt for consistent JSON output
// ---------------------------------------------------------------------------
function buildPrompt({ anomalyType, row, rowNumber, detectedIssue }) {
  return `You are a financial data analyst reviewing a shared expenses CSV import for a flat of roommates.

A data anomaly was detected in row ${rowNumber} of the CSV. Your job is to explain the problem in plain English and suggest a concrete action.

Anomaly Type: ${anomalyType}
Detected Issue: ${detectedIssue}

Row Data:
${JSON.stringify(row, null, 2)}

Respond ONLY with a valid JSON object in this exact shape:
{
  "explanation": "<1-2 sentence plain English explanation of what is wrong with this row>",
  "recommendation": "<1 sentence concrete action: e.g., skip this row, correct field X to Y, or ask user to clarify>"
}

Be specific. Reference the actual values from the row data. Do not add any text outside the JSON.`;
}

/**
 * Batch process multiple anomalies with AI, respecting rate limits.
 * Processes up to 5 in parallel, then waits to avoid quota exhaustion.
 *
 * @param {Array} anomalies - Array of anomaly objects with { type, row, rowNumber, detectedIssue }
 * @returns {Promise<Array>} - Anomalies enriched with { aiExplanation, aiRecommendation }
 */
async function enrichAnomaliesWithAI(anomalies) {
  const results = [];
  const BATCH_SIZE = 5; // process 5 at a time

  for (let i = 0; i < anomalies.length; i += BATCH_SIZE) {
    const batch = anomalies.slice(i, i + BATCH_SIZE);

    const enriched = await Promise.all(
      batch.map(async (anomaly) => {
        const context = await getAnomalyContext({
          anomalyType: anomaly.type,
          row: anomaly.row,
          rowNumber: anomaly.rowNumber,
          detectedIssue: anomaly.message,
        });
        return { ...anomaly, aiContext: context };
      })
    );

    results.push(...enriched);

    // Brief pause between batches to be a good API citizen
    if (i + BATCH_SIZE < anomalies.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return results;
}

module.exports = { getAnomalyContext, enrichAnomaliesWithAI, COMPLEX_ANOMALY_TYPES };
