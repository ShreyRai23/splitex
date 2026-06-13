// =============================================================================
// src/validators/expense.validator.js — Zod schemas for manual expense CRUD
// =============================================================================

const { z } = require('zod');

// ---------------------------------------------------------------------------
// Create Expense Schema
// ---------------------------------------------------------------------------
const CreateExpenseBase = z.object({
  groupId: z
    .number({ required_error: 'groupId is required' })
    .int()
    .positive(),

  paidById: z
    .number({ required_error: 'paidById is required' })
    .int()
    .positive(),

  description: z
    .string({ required_error: 'description is required' })
    .trim()
    .min(1, 'Description cannot be empty')
    .max(255),

  amount: z
    .number({ required_error: 'amount is required' })
    .positive('Amount must be a positive number'),

  currency: z
    .string()
    .trim()
    .toUpperCase()
    .default('INR')
    .refine((v) => ['INR', 'USD'].includes(v), {
      message: 'Unsupported currency. Use INR or USD.',
    }),

  date: z
    .string({ required_error: 'date is required' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),

  splitType: z.enum(['equal', 'percentage', 'exact', 'share'], {
    errorMap: () => ({ message: 'splitType must be equal, percentage, exact, or share' }),
  }),

  // splitWith: array of user IDs who share this expense
  splitWith: z
    .array(z.number().int().positive(), {
      required_error: 'splitWith (array of user IDs) is required',
    })
    .min(1, 'At least one user must be in splitWith'),

  // splitDetails: required for percentage, exact, share types
  // For 'equal', omit or send null.
  splitDetails: z
    .record(z.string(), z.number())
    .optional()
    .nullable(),

  notes: z.string().trim().max(500).optional(),
});

const CreateExpenseSchema = CreateExpenseBase.superRefine((data, ctx) => {
  // Validate that splitDetails is provided when required
  if (['percentage', 'exact', 'share'].includes(data.splitType) && !data.splitDetails) {
    ctx.addIssue({
      path: ['splitDetails'],
      code: z.ZodIssueCode.custom,
      message: `splitDetails is required when splitType is "${data.splitType}"`,
    });
  }

  // Validate percentage totals
  if (data.splitType === 'percentage' && data.splitDetails) {
    const total = Object.values(data.splitDetails).reduce((sum, v) => sum + v, 0);
    // Allow a tiny floating-point tolerance
    if (Math.abs(total - 100) > 0.01) {
      ctx.addIssue({
        path: ['splitDetails'],
        code: z.ZodIssueCode.custom,
        message: `Percentage shares must sum to 100%. Current total: ${total.toFixed(2)}%`,
      });
    }
  }

  // Validate exact amounts don't exceed total
  if (data.splitType === 'exact' && data.splitDetails) {
    const total = Object.values(data.splitDetails).reduce((sum, v) => sum + v, 0);
    if (Math.abs(total - data.amount) > 0.01) {
      ctx.addIssue({
        path: ['splitDetails'],
        code: z.ZodIssueCode.custom,
        message: `Exact split amounts must sum to total (${data.amount}). Current sum: ${total.toFixed(2)}`,
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Update Expense Schema — all fields optional.
// We build from a plain partial object (not from the ZodEffects above) because
// ZodEffects (returned by .superRefine()) does not expose .partial() or .omit().
// ---------------------------------------------------------------------------
const UpdateExpenseSchema = z.object({
  paidById:    z.number().int().positive().optional(),
  description: z.string().trim().min(1).max(255).optional(),
  amount:      z.number().positive().optional(),
  currency:    z.string().trim().toUpperCase()
                 .refine((v) => ['INR', 'USD'].includes(v), { message: 'Unsupported currency.' })
                 .optional(),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  splitType:   z.enum(['equal', 'percentage', 'exact', 'share']).optional(),
  splitWith:   z.array(z.number().int().positive()).min(1).optional(),
  splitDetails:z.record(z.string(), z.number()).optional().nullable(),
  notes:       z.string().trim().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Settlement Schema
// ---------------------------------------------------------------------------
const CreateSettlementSchema = z.object({
  payerId: z.number().int().positive({ message: 'payerId must be a positive integer' }),
  payeeId: z.number().int().positive({ message: 'payeeId must be a positive integer' }),
  amount:  z.number().positive('Amount must be positive'),
  currency: z.string().trim().toUpperCase().default('INR'),
  method: z.string().trim().default('UPI'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  note: z.string().trim().max(500).optional(),
}).refine((d) => d.payerId !== d.payeeId, {
  message: 'payerId and payeeId must be different users',
  path: ['payeeId'],
});

module.exports = { CreateExpenseSchema, UpdateExpenseSchema, CreateSettlementSchema };
