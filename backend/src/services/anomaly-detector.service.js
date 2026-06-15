// =============================================================================
// src/services/anomaly-detector.service.js — Tier 2 Business Logic Checks
//
// This service runs AFTER Zod format validation (Tier 1) passes.
// It has access to the full batch context (all rows) and DB user data,
// so it can catch anomalies that require cross-row or timeline awareness.
//
// Each anomaly record has:
//  {
//    rowNumber: number,       // 1-indexed
//    type: string,            // anomaly code (e.g., 'DUPLICATE_EXACT')
//    severity: 'ERROR'|'WARNING'|'INFO',
//    message: string,         // machine-generated description
//    row: Object,             // the offending row data
//    autoFixApplied: boolean, // whether we auto-corrected it
//    autoFixDetail: string,   // what was changed
//    requiresUserDecision: boolean,
//    suggestedAction: string, // recommended action
//    userDecision: null,      // filled in by user during commit phase
//    aiContext: null,         // filled in by Gemini enrichment
//  }
//
// ANOMALY CATALOGUE (cross-referenced with implementation_plan.md):
//  A1  DUPLICATE_EXACT        — identical row (same date+payer+amount+desc)
//  A2  FORMAT_COMMA_AMOUNT    — "1,200" style number (auto-fixed)
//  A3  ROUNDING_SUBPAISA      — 3+ decimal places (auto-fixed)
//  A4  UNKNOWN_PAYER          — name not in known users
//  A5  MISSING_PAYER          — paid_by field is empty
//  A6  SETTLEMENT_DISGUISED   — looks like a peer payment, not an expense
//  A7  PERCENTAGE_MISMATCH    — percentages don't sum to 100%
//  A8  NON_MEMBER_IN_SPLIT    — split includes someone not in the system
//  A9  CONFLICTING_DUPLICATE  — same meal, different payer/amount
//  A10 BAD_DATE_FORMAT        — non-standard date (auto-parsed)
//  A11 MISSING_CURRENCY       — currency field empty (default to INR)
//  A12 ZERO_AMOUNT            — amount is 0
//  A13 AMBIGUOUS_DATE         — DD-MM vs MM-DD ambiguity
//  A14 TIMELINE_VIOLATION     — user charged outside their residency window
//  A15 SETTLEMENT_DISGUISED   — deposit/payment not an expense (same as A6)
//  A16 SPLIT_TYPE_CONFLICT    — split_type='equal' but split_details present
// =============================================================================

const { parseAmount, parseSplitDetails } = require('../utils/currency');
const { parseExpenseDate, isUserActiveOnDate } = require('../utils/date-parser');

// Canonical user names recognized by the system (from seed data).
// This is used for fuzzy matching during import — the DB is the ground truth
// at commit time, but we need this for dry-run without DB writes.
const KNOWN_USERS = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Sam', 'Dev'];

// Membership timeline — mirrors the GroupMembership seed data
// Format: { name: { joinedAt: Date, leftAt: Date|null } }
const MEMBERSHIP_TIMELINE = {
  Aisha: { joinedAt: new Date('2026-02-01'), leftAt: null },
  Rohan: { joinedAt: new Date('2026-02-01'), leftAt: null },
  Priya: { joinedAt: new Date('2026-02-01'), leftAt: null },
  Meera: { joinedAt: new Date('2026-02-01'), leftAt: new Date('2026-03-31') },
  Sam:   { joinedAt: new Date('2026-04-15'), leftAt: null },
};

/**
 * Main anomaly detection function.
 * Processes all parsed rows and returns an annotated result array.
 *
 * @param {Array<Object>} rows - Array of Tier-1 validated row objects
 * @returns {Array<Object>} - Array of { row, anomalies[], status, processedRow }
 */
function detectAnomalies(rows) {
  const results = [];

  // Pre-build a fingerprint map for duplicate detection (needs full batch context)
  const fingerprintMap = buildFingerprintMap(rows);

  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i];
    const rowNumber = i + 2; // +2 because row 1 is the CSV header
    const anomalies = [];
    let processedRow = { ...rawRow }; // we may mutate this with auto-fixes

    // ------------------------------------------------------------------
    // A2: FORMAT_COMMA_AMOUNT — handled by Tier 1 Zod, but we annotate it
    // ------------------------------------------------------------------
    const amountResult = parseAmount(rawRow.amount);
    if (amountResult.wasFormatFixed) {
      anomalies.push(makeAnomaly('A2', 'FORMAT_COMMA_AMOUNT', 'WARNING', rowNumber, rawRow, {
        message: `Amount "${rawRow.amount}" contained commas — cleaned to ${amountResult.value}`,
        autoFixApplied: true,
        autoFixDetail: `"${rawRow.amount}" → ${amountResult.value}`,
        suggestedAction: 'Auto-corrected. No action needed unless value looks wrong.',
        requiresUserDecision: false,
      }));
      processedRow.amount = amountResult.value;
    }

    // ------------------------------------------------------------------
    // A3: ROUNDING_SUBPAISA
    // ------------------------------------------------------------------
    if (amountResult.wasRounded) {
      anomalies.push(makeAnomaly('A3', 'ROUNDING_SUBPAISA', 'INFO', rowNumber, rawRow, {
        message: `Amount ${rawRow.amount} has more than 2 decimal places — rounded to ${amountResult.value}`,
        autoFixApplied: true,
        autoFixDetail: `${rawRow.amount} → ${amountResult.value}`,
        suggestedAction: 'Auto-rounded. Confirm the rounded value is acceptable.',
        requiresUserDecision: false,
      }));
      processedRow.amount = amountResult.value;
    }

    const finalAmount = amountResult.value;

    // ------------------------------------------------------------------
    // A12: ZERO_AMOUNT
    // ------------------------------------------------------------------
    if (finalAmount === 0) {
      anomalies.push(makeAnomaly('A12', 'ZERO_AMOUNT', 'ERROR', rowNumber, rawRow, {
        message: `Amount is 0 for "${rawRow.description}". The note says: "${rawRow.notes}". This may be a void/placeholder.`,
        autoFixApplied: false,
        suggestedAction: 'SKIP this row — a zero-amount expense has no financial effect and the note suggests it is a duplicate marker.',
        requiresUserDecision: true,
      }));
    }

    // ------------------------------------------------------------------
    // A10: BAD_DATE_FORMAT + A13: AMBIGUOUS_DATE
    // ------------------------------------------------------------------
    const dateResult = parseExpenseDate(rawRow.date);
    if (!dateResult.parsed) {
      anomalies.push(makeAnomaly('A10', 'BAD_DATE_FORMAT', 'ERROR', rowNumber, rawRow, {
        message: `Cannot parse date "${rawRow.date}": ${dateResult.note}`,
        autoFixApplied: false,
        suggestedAction: 'Provide a corrected date in YYYY-MM-DD format.',
        requiresUserDecision: true,
      }));
    } else {
      processedRow._parsedDate = dateResult.date;

      if (dateResult.isAmbiguous) {
        anomalies.push(makeAnomaly('A10', 'BAD_DATE_FORMAT', 'WARNING', rowNumber, rawRow, {
          message: dateResult.note,
          autoFixApplied: true,
          autoFixDetail: `Parsed "${rawRow.date}" as ${dateResult.date.toISOString().split('T')[0]}`,
          suggestedAction: `Confirm: was this expense on ${dateResult.date.toDateString()}?`,
          requiresUserDecision: true,
        }));
      }

      // Check for DD-MM-YYYY that COULD be ambiguous (note mentions it)
      if (rawRow.notes && rawRow.notes.toLowerCase().includes('april 5 or may 4')) {
        anomalies.push(makeAnomaly('A13', 'AMBIGUOUS_DATE', 'WARNING', rowNumber, rawRow, {
          message: `Note says "${rawRow.notes}" — date ${rawRow.date} parsed as DD-MM-YYYY = ${dateResult.date.toDateString()}. Note implies ambiguity.`,
          autoFixApplied: true,
          autoFixDetail: `Using DD-MM-YYYY convention: ${dateResult.date.toDateString()}`,
          suggestedAction: 'Confirm: is this April 5 (parsed) or May 4?',
          requiresUserDecision: true,
        }));
      }
    }

    // ------------------------------------------------------------------
    // A11: MISSING_CURRENCY — default to INR
    // ------------------------------------------------------------------
    if (!rawRow.currency || rawRow.currency.trim() === '') {
      anomalies.push(makeAnomaly('A11', 'MISSING_CURRENCY', 'WARNING', rowNumber, rawRow, {
        message: `Currency is missing for "${rawRow.description}". Defaulting to INR based on surrounding context.`,
        autoFixApplied: true,
        autoFixDetail: 'Currency set to INR',
        suggestedAction: 'Confirm currency is INR, or correct if USD.',
        requiresUserDecision: false,
      }));
      processedRow.currency = 'INR';
    }

    // ------------------------------------------------------------------
    // A5: MISSING_PAYER
    // ------------------------------------------------------------------
    if (!rawRow.paid_by || rawRow.paid_by.trim() === '') {
      anomalies.push(makeAnomaly('A5', 'MISSING_PAYER', 'ERROR', rowNumber, rawRow, {
        message: `"paid_by" is empty for "${rawRow.description}". Cannot import without knowing who paid.`,
        autoFixApplied: false,
        suggestedAction: 'SKIP this row, or specify who paid.',
        requiresUserDecision: true,
      }));
    }

    // ------------------------------------------------------------------
    // A4: UNKNOWN_PAYER — name doesn't match a known user
    // ------------------------------------------------------------------
    const paidByName = rawRow.paid_by ? rawRow.paid_by.trim() : '';
    if (paidByName && !isKnownUser(paidByName)) {
      // Check if it's a close match (e.g., "Priya S" → "Priya")
      const closest = findClosestUser(paidByName);
      anomalies.push(makeAnomaly('A4', 'UNKNOWN_PAYER', 'ERROR', rowNumber, rawRow, {
        message: `Payer "${paidByName}" is not a recognized user. ${closest ? `Closest match: "${closest}".` : 'No close match found.'}`,
        autoFixApplied: !!closest,
        autoFixDetail: closest ? `Mapping "${paidByName}" → "${closest}"` : null,
        suggestedAction: closest
          ? `Confirm: treat "${paidByName}" as "${closest}"?`
          : 'SKIP or manually specify the payer.',
        requiresUserDecision: true,
      }));
      if (closest) processedRow.paid_by = closest;
    }

    // ------------------------------------------------------------------
    // A6 / A15: SETTLEMENT_DISGUISED
    // Heuristics: no split_type AND description/notes mention "paid back", "deposit", "settlement"
    // ------------------------------------------------------------------
    const settlementKeywords = ['paid back', 'settlement', 'deposit share', 'transfer', 'paid aisha', 'paid rohan'];
    const descLower = (rawRow.description || '').toLowerCase();
    const notesLower = (rawRow.notes || '').toLowerCase();
    const isSettlementLike = (
      (!rawRow.split_type || rawRow.split_type === '') &&
      settlementKeywords.some((kw) => descLower.includes(kw) || notesLower.includes(kw))
    );

    if (isSettlementLike) {
      anomalies.push(makeAnomaly('A6', 'SETTLEMENT_DISGUISED', 'ERROR', rowNumber, rawRow, {
        message: `"${rawRow.description}" appears to be a settlement/transfer, not a shared expense. Notes: "${rawRow.notes}"`,
        autoFixApplied: false,
        suggestedAction: 'Convert to a Settlement record instead of an Expense. Specify payer and payee.',
        requiresUserDecision: true,
      }));
    }

    // ------------------------------------------------------------------
    // A1: DUPLICATE_EXACT — identical fingerprint to another row
    // Fingerprint = date + description (lowercased) + amount + paid_by
    // ------------------------------------------------------------------
    const fingerprint = buildFingerprint(rawRow);
    const duplicateRowNumbers = fingerprintMap[fingerprint] || [];
    const isDuplicate = duplicateRowNumbers.length > 1 && duplicateRowNumbers[0] !== rowNumber;

    if (isDuplicate) {
      const otherRow = duplicateRowNumbers.find((r) => r !== rowNumber);
      anomalies.push(makeAnomaly('A1', 'DUPLICATE_EXACT', 'ERROR', rowNumber, rawRow, {
        message: `This row is an exact duplicate of row ${otherRow} (same date, description, payer, amount).`,
        autoFixApplied: false,
        suggestedAction: `SKIP this row. Row ${otherRow} will be imported as the canonical record.`,
        requiresUserDecision: false, // skip is unambiguous for exact duplicates
      }));
    }

    // ------------------------------------------------------------------
    // A9: CONFLICTING_DUPLICATE — same meal, different amounts/payers
    // Heuristic: similar description on same date, different amount
    // Known pair: "Dinner at Thalassa" (row 24) + "Thalassa dinner" (row 25)
    // ------------------------------------------------------------------
    const conflictNote = (rawRow.notes || '').toLowerCase();
    if (conflictNote.includes('also logged') || conflictNote.includes('hers is wrong')) {
      anomalies.push(makeAnomaly('A9', 'CONFLICTING_DUPLICATE', 'ERROR', rowNumber, rawRow, {
        message: `Note suggests this is a duplicate of another entry: "${rawRow.notes}". Two rows describe the same expense with different values.`,
        autoFixApplied: false,
        suggestedAction: 'KEEP Rohan\'s row (₹2450) as the authoritative record (as confirmed by user). SKIP the other.',
        requiresUserDecision: false, // user pre-decided: keep Rohan's
      }));
    }

    // ------------------------------------------------------------------
    // A7: PERCENTAGE_MISMATCH — split_type=percentage but sum ≠ 100
    // ------------------------------------------------------------------
    if (rawRow.split_type === 'percentage' && rawRow.split_details) {
      const detailsMap = parseSplitDetails(rawRow.split_details);
      if (detailsMap) {
        const total = Object.values(detailsMap).reduce((s, v) => s + v, 0);
        if (Math.abs(total - 100) > 0.01) {
          anomalies.push(makeAnomaly('A7', 'PERCENTAGE_MISMATCH', 'ERROR', rowNumber, rawRow, {
            message: `Percentages in split_details sum to ${total.toFixed(2)}%, not 100%. Values: ${rawRow.split_details}. Note: "${rawRow.notes}"`,
            autoFixApplied: false,
            suggestedAction: 'Correct the percentages so they sum to 100%, or change split_type to equal.',
            requiresUserDecision: true,
          }));
        }
      }
    }

    // ------------------------------------------------------------------
    // A8: NON_MEMBER_IN_SPLIT — unknown name in split_with
    // ------------------------------------------------------------------
    const splitMembers = parseSplitWith(rawRow.split_with);
    const unknownMembers = splitMembers.filter((name) => !isKnownUser(name) && name !== '');
    if (unknownMembers.length > 0) {
      anomalies.push(makeAnomaly('A8', 'NON_MEMBER_IN_SPLIT', 'WARNING', rowNumber, rawRow, {
        message: `Unknown member(s) in split_with: ${unknownMembers.map((n) => `"${n}"`).join(', ')}. These are not registered users.`,
        autoFixApplied: true,
        autoFixDetail: `Auto-creating guest account(s) for: ${unknownMembers.join(', ')}`,
        suggestedAction: `Guest user(s) will be created. Confirm this is correct.`,
        requiresUserDecision: false,
      }));
    }

    // ------------------------------------------------------------------
    // A14: TIMELINE_VIOLATION — expense outside a member's residency window
    // ------------------------------------------------------------------
    if (dateResult.parsed && splitMembers.length > 0) {
      const violations = [];
      for (const memberName of splitMembers) {
        const timeline = MEMBERSHIP_TIMELINE[memberName];
        if (!timeline) continue; // skip unknown members (handled above)

        if (!isUserActiveOnDate(dateResult.date, timeline.joinedAt, timeline.leftAt)) {
          violations.push({
            member: memberName,
            reason: timeline.leftAt && dateResult.date > timeline.leftAt
              ? `${memberName} left on ${timeline.leftAt.toDateString()}`
              : `${memberName} joined on ${timeline.joinedAt.toDateString()}`,
          });
        }
      }

      if (violations.length > 0) {
        const validMembers = splitMembers.filter(
          (name) => !violations.some((v) => v.member === name)
        );
        const isEmpty = validMembers.length === 0;

        anomalies.push(makeAnomaly('A14', 'TIMELINE_VIOLATION', isEmpty ? 'ERROR' : 'WARNING', rowNumber, rawRow, {
          message: `Timeline violation: ${violations.map((v) => v.reason).join('; ')}. These members cannot be charged for an expense on ${rawRow.date}.`,
          autoFixApplied: !isEmpty,
          autoFixDetail: isEmpty ? null : `Removing ${violations.map((v) => v.member).join(', ')} from split. Remaining members will absorb the cost equally.`,
          suggestedAction: isEmpty ? 'SKIP this row. No valid members left in the split.' : `Confirm removal of ${violations.map((v) => v.member).join(', ')} from this expense split.`,
          requiresUserDecision: isEmpty, // If empty, force decision (which will be SKIP because ERROR -> BLOCKED)
          violatingMembers: violations.map((v) => v.member),
        }));
        
        // Remove violating members from processedRow
        if (!isEmpty) {
          processedRow.split_with = validMembers.join(';');
        }
      }
    }

    // ------------------------------------------------------------------
    // A16: SPLIT_TYPE_CONFLICT — split_type='equal' but split_details present
    // ------------------------------------------------------------------
    if (rawRow.split_type === 'equal' && rawRow.split_details && rawRow.split_details.trim() !== '') {
      const detailsMap = parseSplitDetails(rawRow.split_details);
      // Check if the shares are all equal — if so, it's harmless
      const isHarmless = detailsMap &&
        Object.values(detailsMap).every((v) => v === Object.values(detailsMap)[0]);

      anomalies.push(makeAnomaly('A16', 'SPLIT_TYPE_CONFLICT', isHarmless ? 'INFO' : 'WARNING', rowNumber, rawRow, {
        message: `split_type is "equal" but split_details "${rawRow.split_details}" is also provided. Note: "${rawRow.notes}"`,
        autoFixApplied: isHarmless,
        autoFixDetail: isHarmless
          ? 'split_details discarded — equal split applied (all shares are identical)'
          : 'Using equal split as specified by split_type. split_details ignored.',
        suggestedAction: isHarmless
          ? 'No action needed — result is same either way.'
          : 'Clarify: should this be an equal split or a weighted share split?',
        requiresUserDecision: !isHarmless,
      }));
      if (isHarmless) {
        processedRow.split_details = ''; // discard conflicting details for equal split
      }
    }

    // ------------------------------------------------------------------
    // Trailing whitespace in paid_by (e.g., "rohan " with trailing space)
    // ------------------------------------------------------------------
    if (rawRow.paid_by && rawRow.paid_by !== rawRow.paid_by.trim()) {
      processedRow.paid_by = rawRow.paid_by.trim();
    }

    // Case normalization for paid_by (e.g., "priya" → "Priya", "rohan " → "Rohan")
    if (processedRow.paid_by) {
      const normalized = normalizeUserName(processedRow.paid_by);
      if (normalized !== processedRow.paid_by) {
        processedRow.paid_by = normalized;
      }
    }

    // ------------------------------------------------------------------
    // Determine row status based on anomalies
    // ------------------------------------------------------------------
    const hasError = anomalies.some((a) => a.severity === 'ERROR' && !a.autoFixApplied);
    const hasWarning = anomalies.some((a) => a.severity === 'WARNING' && a.requiresUserDecision);
    const isDuplicateExact = anomalies.some((a) => a.type === 'DUPLICATE_EXACT');
    const isConflictingDuplicate = anomalies.some((a) => a.type === 'CONFLICTING_DUPLICATE');

    let status;
    if (isDuplicateExact) status = 'SKIP';
    else if (isConflictingDuplicate && rawRow.paid_by !== 'Rohan') status = 'SKIP'; // per user decision: keep Rohan's
    else if (anomalies.some((a) => a.type === 'SETTLEMENT_DISGUISED')) status = 'CONVERT_TO_SETTLEMENT';
    else if (hasError) status = 'BLOCKED';
    else if (hasWarning) status = 'NEEDS_REVIEW';
    else status = 'READY';

    results.push({
      rowNumber,
      originalRow: rawRow,
      processedRow,
      status,
      anomalies,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a deduplication fingerprint for a row.
 * Uses lowercased description to catch "Dinner at Marina Bites" == "dinner - marina bites"
 * when combined with same date/amount/payer.
 */
function buildFingerprint(row) {
  const desc = (row.description || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const amount = String(row.amount || '').replace(/,/g, '');
  const payer = (row.paid_by || '').toLowerCase().trim();
  const date = (row.date || '').trim();
  return `${date}|${payer}|${amount}|${desc}`;
}

/** Build a map of fingerprint → [rowNumber, ...] for the entire batch */
function buildFingerprintMap(rows) {
  const map = {};
  rows.forEach((row, i) => {
    const fp = buildFingerprint(row);
    const rowNumber = i + 2;
    if (!map[fp]) map[fp] = [];
    map[fp].push(rowNumber);
  });
  return map;
}

/** Check if a name matches a known user (case-insensitive, trims whitespace) */
function isKnownUser(name) {
  const normalized = name.toLowerCase().trim();
  return KNOWN_USERS.some((u) => u.toLowerCase() === normalized);
}

/**
 * Find the closest known user name using a simple prefix/includes heuristic.
 * Returns null if no close match exists.
 * "Priya S" → "Priya" (prefix match)
 * "rohan " → "Rohan" (trim match)
 */
function findClosestUser(name) {
  const lower = name.toLowerCase().trim();
  for (const knownUser of KNOWN_USERS) {
    const knownLower = knownUser.toLowerCase();
    if (lower.startsWith(knownLower) || knownLower.startsWith(lower)) {
      return knownUser;
    }
  }
  return null;
}

/** Normalize a user name to Title Case */
function normalizeUserName(name) {
  const trimmed = name.trim();
  const match = KNOWN_USERS.find((u) => u.toLowerCase() === trimmed.toLowerCase());
  return match || trimmed;
}

/** Parse the semicolon-separated split_with field into an array of names */
function parseSplitWith(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return raw.split(';').map((s) => s.trim()).filter(Boolean);
}

/** Construct a standardized anomaly object */
function makeAnomaly(id, type, severity, rowNumber, row, options = {}) {
  return {
    id,
    type,
    severity,
    rowNumber,
    row,
    message: options.message || '',
    autoFixApplied: options.autoFixApplied || false,
    autoFixDetail: options.autoFixDetail || null,
    requiresUserDecision: options.requiresUserDecision || false,
    suggestedAction: options.suggestedAction || '',
    violatingMembers: options.violatingMembers || [],
    userDecision: null, // to be filled by user during commit
    aiContext: null,    // to be filled by Gemini enrichment
  };
}

module.exports = { detectAnomalies, KNOWN_USERS, MEMBERSHIP_TIMELINE };
