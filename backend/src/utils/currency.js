// =============================================================================
// src/utils/currency.js — Currency parsing helpers
//
// The CSV has amounts like "1,200" (string comma) and "899.995" (3 decimals).
// These must be sanitized before any arithmetic.
// =============================================================================

/**
 * Parse an amount value that may be:
 *  - A plain number: 3200
 *  - A string number: "3200"
 *  - A comma-formatted string: "1,200" (Tier 1 anomaly A2)
 *  - A high-precision decimal: 899.995 (Tier 1 anomaly A3)
 *  - Zero: 0 (Tier 1 anomaly A12)
 *
 * Returns:
 * {
 *   value: number | null,
 *   wasFormatFixed: boolean,  // true if comma was stripped
 *   wasRounded: boolean,      // true if decimal was truncated to 2 places
 *   original: string,         // the raw input
 *   note: string | null,
 * }
 */
function parseAmount(rawAmount) {
  const original = String(rawAmount ?? '').trim();

  if (original === '' || original === null) {
    return { value: null, wasFormatFixed: false, wasRounded: false, original, note: 'Amount is empty' };
  }

  let wasFormatFixed = false;
  let wasRounded = false;
  let cleaned = original;

  // Strip commas — handles "1,200" → "1200"
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/,/g, '');
    wasFormatFixed = true;
  }

  const numericValue = parseFloat(cleaned);

  if (isNaN(numericValue)) {
    return { value: null, wasFormatFixed, wasRounded, original, note: `Cannot parse "${original}" as a number` };
  }

  // Round to 2 decimal places (sub-paisa amounts like 899.995 → 900.00)
  const roundedValue = Math.round(numericValue * 100) / 100;
  if (roundedValue !== numericValue) {
    wasRounded = true;
  }

  const notes = [];
  if (wasFormatFixed) notes.push(`Comma removed from "${original}"`);
  if (wasRounded) notes.push(`Rounded from ${numericValue} to ${roundedValue}`);

  return {
    value: roundedValue,
    wasFormatFixed,
    wasRounded,
    original,
    note: notes.length ? notes.join('; ') : null,
  };
}

/**
 * Parse the split_details string into a structured map.
 *
 * Formats handled:
 *   "Aisha 30%; Rohan 30%; Priya 30%; Meera 20%"  → { Aisha: 30, Rohan: 30, ... }
 *   "Rohan 700; Priya 400; Meera 400"              → { Rohan: 700, Priya: 400, ... }
 *   "Aisha 1; Rohan 2; Priya 1; Dev 2"             → { Aisha: 1, Rohan: 2, ... }
 *
 * Returns: { [name]: number } or null if parsing fails.
 */
function parseSplitDetails(rawDetails) {
  if (!rawDetails || typeof rawDetails !== 'string' || rawDetails.trim() === '') {
    return null;
  }

  const result = {};
  const parts = rawDetails.split(';').map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    // Try "Name value%" or "Name value"
    const match = part.match(/^(.+?)\s+([\d.]+)%?$/);
    if (!match) return null; // unparseable

    const name = match[1].trim();
    const value = parseFloat(match[2]);

    if (isNaN(value)) return null;
    result[name] = value;
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Detect if split_details values look like percentages (any value > 1 means likely %).
 * Used to distinguish "Aisha 30" (percent) from "Rohan 2" (share count).
 */
function detectSplitDetailType(splitDetailsMap) {
  if (!splitDetailsMap) return null;
  const values = Object.values(splitDetailsMap);
  const hasPercent = values.some((v) => v > 1);
  // If all values ≤ 1, they could be ratios (0.25 each), but we check split_type too.
  return hasPercent ? 'percentage' : 'share';
}

module.exports = { parseAmount, parseSplitDetails, detectSplitDetailType };
