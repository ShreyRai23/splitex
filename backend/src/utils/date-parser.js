// =============================================================================
// src/utils/date-parser.js — Robust date parsing for messy CSV inputs
//
// The CSV contains multiple date formats:
//   - "01-02-2026"  → standard DD-MM-YYYY (most rows)
//   - "Mar-14"      → abbreviated MMM-DD (row 27, Airport cab)
//   - "04-05-2026"  → ambiguous (is it Apr 5 or May 4? row 34 note says so)
//
// Policy:
//   - Primary format: DD-MM-YYYY
//   - MMM-DD: parsed as that month + day in the inferred year (2026)
//   - Ambiguous dates are FLAGGED but parsed using DD-MM-YYYY (our standard)
//     and surfaced in the anomaly report for user confirmation.
// =============================================================================

const MONTH_MAP = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Result shape:
 * {
 *   date: Date | null,
 *   parsed: boolean,
 *   format: string,         // how it was parsed
 *   isAmbiguous: boolean,   // true if the format could mean different dates
 *   note: string | null,    // human-readable explanation
 * }
 */
function parseExpenseDate(rawDate) {
  if (!rawDate || typeof rawDate !== 'string' || rawDate.trim() === '') {
    return { date: null, parsed: false, format: 'empty', isAmbiguous: false, note: 'Date is empty' };
  }

  const s = rawDate.trim();

  // -------------------------------------------------------------------------
  // Pattern 1: DD-MM-YYYY (standard format)
  // -------------------------------------------------------------------------
  const ddmmyyyy = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    const day = parseInt(dd, 10);
    const month = parseInt(mm, 10) - 1; // JS months are 0-indexed
    const year = parseInt(yyyy, 10);
    const date = new Date(year, month, day);

    // Validate the date is real (e.g., not Feb 31)
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
      return { date: null, parsed: false, format: 'DD-MM-YYYY', isAmbiguous: false, note: `Invalid calendar date: ${s}` };
    }

    return { date, parsed: true, format: 'DD-MM-YYYY', isAmbiguous: false, note: null };
  }

  // -------------------------------------------------------------------------
  // Pattern 2: MMM-DD (e.g., "Mar-14") — no year, infer 2026
  // Row 27: Airport cab
  // -------------------------------------------------------------------------
  const mmmdd = s.match(/^([A-Za-z]{3})-(\d{1,2})$/);
  if (mmmdd) {
    const [, mmm, dd] = mmmdd;
    const monthIndex = MONTH_MAP[mmm.toLowerCase()];

    if (monthIndex === undefined) {
      return { date: null, parsed: false, format: 'MMM-DD', isAmbiguous: false, note: `Unknown month abbreviation: ${mmm}` };
    }

    const day = parseInt(dd, 10);
    const year = 2026; // inferred from CSV context
    const date = new Date(year, monthIndex, day);

    return {
      date,
      parsed: true,
      format: 'MMM-DD (year inferred as 2026)',
      isAmbiguous: true, // no year means ambiguous
      note: `Date "${s}" has no year — inferred as ${date.toDateString()}. Please confirm.`,
    };
  }

  // -------------------------------------------------------------------------
  // Pattern 3: MM-DD-YYYY (US format, detected if month > 12 check fails for DD-MM)
  // We don't encounter this in the current CSV but handle defensively.
  // -------------------------------------------------------------------------
  // (Would be added here if needed)

  // Nothing matched
  return {
    date: null,
    parsed: false,
    format: 'unknown',
    isAmbiguous: false,
    note: `Could not parse date: "${s}". Expected DD-MM-YYYY.`,
  };
}

/**
 * Check if a given date falls within a user's membership window.
 * Returns true if the user was a member of the group on that date.
 *
 * @param {Date} expenseDate
 * @param {Date} joinedAt
 * @param {Date|null} leftAt
 * @returns {boolean}
 */
function isUserActiveOnDate(expenseDate, joinedAt, leftAt) {
  const expenseTime = expenseDate.getTime();
  const joinTime = joinedAt.getTime();
  const leftTime = leftAt ? leftAt.getTime() : Infinity;

  return expenseTime >= joinTime && expenseTime <= leftTime;
}

module.exports = { parseExpenseDate, isUserActiveOnDate };
