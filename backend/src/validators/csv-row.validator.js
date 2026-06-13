// =============================================================================
// src/validators/csv-row.validator.js — Zod schema for a single CSV row
//
// This is the Tier 1 (format-level) validation layer.
// It runs on every parsed row BEFORE business logic checks (Tier 2).
//
// Tier 1 catches:
//  - Wrong types (string where number expected)
//  - Empty required fields
//  - Unknown enum values (split_type)
//
// It deliberately does NOT catch:
//  - Timeline violations (need DB data — Tier 2)
//  - Duplicate entries (need full batch context — Tier 2)
//  - Percentage math errors (need split_details parsing — Tier 2)
// =============================================================================

const { z } = require('zod');

// ---------------------------------------------------------------------------
// Helper: parse a "dirty" amount string like "1,200" or "899.995"
// Returns the cleaned numeric value or throws a ZodError
// ---------------------------------------------------------------------------
const dirtyAmountSchema = z
  .union([z.string(), z.number()])
  .transform((val, ctx) => {
    const str = String(val).trim().replace(/,/g, ''); // strip commas
    const num = parseFloat(str);
    if (isNaN(num)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid amount: "${val}"` });
      return z.NEVER;
    }
    return num;
  });

// ---------------------------------------------------------------------------
// The split_type enum — must match exactly what the CSV uses
// "unequal" from CSV row 12 maps to our DB enum value "exact"
// ---------------------------------------------------------------------------
const SplitTypeEnum = z.enum(['equal', 'percentage', 'unequal', 'share', ''], {
  errorMap: () => ({ message: 'split_type must be equal, percentage, unequal, or share' }),
});

// ---------------------------------------------------------------------------
// CSV Row Schema
// ---------------------------------------------------------------------------
const CsvRowSchema = z.object({
  // date: raw string — actual parsing/validation is in date-parser.js
  date: z.string().trim(),

  // description: required non-empty string
  description: z
    .string()
    .trim()
    .min(1, 'Description cannot be empty'),

  // paid_by: may be empty (anomaly A5 — missing payer)
  paid_by: z.string().trim().default(''),

  // amount: dirty numeric — strips commas, coerces string→number
  amount: dirtyAmountSchema,

  // currency: may be empty (anomaly A11 — missing currency)
  currency: z.string().trim().default(''),

  // split_type: may be empty (anomaly A6 — disguised settlement has no split type)
  split_type: SplitTypeEnum.default(''),

  // split_with: semicolon-separated list of names
  split_with: z.string().trim().default(''),

  // split_details: optional free-form string
  split_details: z.string().trim().default(''),

  // notes: optional
  notes: z.string().trim().default(''),
});

/**
 * Parse and validate a single raw CSV row object.
 * Returns { success: true, data } or { success: false, errors: ZodError.errors }
 */
function validateCsvRow(rawRow) {
  const result = CsvRowSchema.safeParse(rawRow);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.errors.map((e) => ({
      field: e.path.join('.') || 'row',
      message: e.message,
      received: e.received,
    })),
  };
}

module.exports = { CsvRowSchema, validateCsvRow };
