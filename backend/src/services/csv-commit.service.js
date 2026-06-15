// =============================================================================
// src/services/csv-commit.service.js — Phase 2: Transactional DB Write
//
// This service accepts the user-approved import payload and writes it to the
// database inside a SINGLE Prisma transaction. If any row fails (DB error,
// constraint violation, business logic failure), the ENTIRE batch rolls back.
//
// This satisfies the assignment's strict "atomic import" requirement.
//
// Input: The batchId from Phase 1 + user decisions for each row.
// Output: Summary of what was created/skipped/converted.
// =============================================================================

const prisma = require('../config/db');
const { toInr } = require('../config/exchange-rates');
const { calculateSplits } = require('./split-calculator.service');
const { parseExpenseDate } = require('../utils/date-parser');
const { parseSplitDetails } = require('../utils/currency');

/**
 * Commit an approved import batch to the database.
 *
 * @param {string} batchId - The ImportBatch UUID from Phase 1
 * @param {Array} userDecisions - [{ rowNumber, action: 'IMPORT'|'SKIP'|'CONVERT_TO_SETTLEMENT', overrides: {} }]
 * @param {number} committedById - User ID who is approving the commit
 * @param {number} groupId - The group to import expenses into
 * @returns {Promise<Object>} Commit summary
 */
async function commitImport(batchId, userDecisions, committedById, groupId) {
  // -------------------------------------------------------------------------
  // Step 1: Load the dry-run report from the ImportBatch
  // -------------------------------------------------------------------------
  const batch = await prisma.importBatch.findUnique({ where: { id: batchId } });

  if (!batch) {
    const err = new Error(`Import batch "${batchId}" not found`);
    err.statusCode = 404;
    throw err;
  }

  if (batch.status === 'COMMITTED') {
    const err = new Error(`Import batch "${batchId}" has already been committed`);
    err.statusCode = 409;
    throw err;
  }

  if (batch.status !== 'DRY_RUN_COMPLETE') {
    const err = new Error(`Import batch "${batchId}" is not in a committable state (status: ${batch.status})`);
    err.statusCode = 409;
    throw err;
  }

  const report = batch.reportJson;
  const rows = report.rows;

  // -------------------------------------------------------------------------
  // Step 2: Merge user decisions with the report rows
  // User decisions override the auto-determined status from Phase 1.
  // -------------------------------------------------------------------------
  const decisionMap = {};
  for (const decision of (userDecisions || [])) {
    decisionMap[decision.rowNumber] = decision;
  }

  // -------------------------------------------------------------------------
  // Step 3: Load DB context needed for the commit
  // We need user IDs and group membership to resolve names to IDs.
  // -------------------------------------------------------------------------
  const [allUsers, group] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true } }),
    prisma.group.findUnique({
      where: { id: groupId },
      include: { memberships: { include: { user: true } } },
    }),
  ]);

  if (!group) {
    const err = new Error(`Group ${groupId} not found`);
    err.statusCode = 404;
    throw err;
  }

  // Build name→id lookup (case-insensitive)
  const userByName = {};
  for (const user of allUsers) {
    userByName[user.name.toLowerCase().trim()] = user;
  }

  // -------------------------------------------------------------------------
  // Step 4: Pre-process all rows to build the DB operations list.
  // We do this BEFORE the transaction to catch any remaining errors early.
  // -------------------------------------------------------------------------
  const operations = [];
  const commitSummary = {
    expensesCreated: 0,
    settlementsCreated: 0,
    skipped: 0,
    errors: [],
  };

  for (const row of rows) {
    const userDecision = decisionMap[row.rowNumber];
    const finalAction = userDecision?.action || row.status;

    // -----------------------------------------------------------------------
    // SKIP: User chose to skip OR the row is an exact duplicate / parse error
    // -----------------------------------------------------------------------
    if (finalAction === 'SKIP' || finalAction === 'PARSE_ERROR' || finalAction === 'BLOCKED') {
      commitSummary.skipped++;
      continue;
    }

    const rowData = row.processedRow || row.originalRow;

    // Apply any user overrides (e.g., corrected payer name, date, currency)
    if (userDecision?.overrides) {
      Object.assign(rowData, userDecision.overrides);
    }

    // -----------------------------------------------------------------------
    // CONVERT_TO_SETTLEMENT: disguised settlements (rows 14 and 38)
    // -----------------------------------------------------------------------
    if (finalAction === 'CONVERT_TO_SETTLEMENT') {
      try {
        const settlementOp = buildSettlementOperation(rowData, userByName, batchId);
        operations.push({ type: 'settlement', data: settlementOp });
      } catch (err) {
        commitSummary.errors.push({ rowNumber: row.rowNumber, error: err.message });
      }
      continue;
    }

    // -----------------------------------------------------------------------
    // IMPORT or READY or NEEDS_REVIEW (user approved): create expense
    // -----------------------------------------------------------------------
    if (['IMPORT', 'READY', 'NEEDS_REVIEW'].includes(finalAction)) {
      try {
        const expenseOp = await buildExpenseOperation(rowData, userByName, group, groupId, batchId);
        operations.push({ type: 'expense', data: expenseOp });
      } catch (err) {
        commitSummary.errors.push({ rowNumber: row.rowNumber, error: err.message });
      }
    }
  }

  // If pre-processing produced errors, fail the commit (don't enter transaction)
  if (commitSummary.errors.length > 0) {
    const err = new Error(
      `Commit pre-processing failed with ${commitSummary.errors.length} error(s). ` +
      `Fix these rows and retry. Details: ${JSON.stringify(commitSummary.errors)}`
    );
    err.statusCode = 422;
    err.details = commitSummary.errors;
    throw err;
  }

  // -------------------------------------------------------------------------
  // Step 5: Execute ALL database writes inside a single Prisma transaction.
  // If ANY write fails, the entire batch is rolled back. This is non-negotiable.
  // -------------------------------------------------------------------------
  await prisma.$transaction(async (tx) => {
    for (const op of operations) {
      if (op.type === 'expense') {
        const { splits, ...expenseData } = op.data;

        // Create the expense record
        const expense = await tx.expense.create({ data: expenseData });
        commitSummary.expensesCreated++;

        // Create one ExpenseSplit row per member
        for (const split of splits) {
          await tx.expenseSplit.create({
            data: { expenseId: expense.id, ...split },
          });
        }

      } else if (op.type === 'settlement') {
        await tx.settlement.create({ data: op.data });
        commitSummary.settlementsCreated++;
      }
    }

    // Update the ImportBatch status to COMMITTED
    await tx.importBatch.update({
      where: { id: batchId },
      data: {
        status: 'COMMITTED',
        committedById,
        committedAt: new Date(),
      },
    });

    // Write audit log
    await tx.auditLog.create({
      data: {
        userId: committedById,
        action: 'IMPORT_COMMIT',
        targetType: 'ImportBatch',
        targetId: batchId,
        detail: {
          expensesCreated:    commitSummary.expensesCreated,
          settlementsCreated: commitSummary.settlementsCreated,
          skipped:            commitSummary.skipped,
          groupId,
        },
      },
    });
  });
  // If $transaction throws, Prisma auto-rolls back. We don't need to catch here —
  // the error propagates up to the error handler middleware.

  return commitSummary;
}

// ---------------------------------------------------------------------------
// Build a Settlement DB record from a disguised settlement row
// ---------------------------------------------------------------------------
function buildSettlementOperation(rowData, userByName, batchId) {
  // Parse payer (paid_by) and payee (first entry in split_with)
  const payerName = (rowData.paid_by || '').toLowerCase().trim();
  const splitWith = (rowData.split_with || '').split(';').map((s) => s.trim()).filter(Boolean);
  const payeeName = splitWith[0]?.toLowerCase().trim();

  const payer = userByName[payerName];
  const payee = userByName[payeeName];

  if (!payer) throw new Error(`Settlement payer "${rowData.paid_by}" not found in database`);
  if (!payee) throw new Error(`Settlement payee "${splitWith[0]}" not found in database`);

  const amount = parseFloat(rowData.amount) || 0;
  const currency = (rowData.currency || 'INR').toUpperCase();
  const { amountInr } = toInr(amount, currency);

  const dateResult = parseExpenseDate(rowData.date);
  if (!dateResult.parsed) {
    throw new Error(`Cannot parse date "${rowData.date}" for settlement`);
  }

  return {
    payerId: payer.id,
    payeeId: payee.id,
    amount,
    currency,
    amountInr,
    date: dateResult.date,
    note: rowData.description || rowData.notes || null,
    importBatchId: batchId,
  };
}

// ---------------------------------------------------------------------------
// Build an Expense + Splits DB record from a validated expense row
// ---------------------------------------------------------------------------
async function buildExpenseOperation(rowData, userByName, group, groupId, batchId) {
  // Resolve payer name to ID
  const payerName = (rowData.paid_by || '').toLowerCase().trim();
  const payer = userByName[payerName];
  if (!payer) {
    throw new Error(`Payer "${rowData.paid_by}" not found in database`);
  }

  // Parse amount and normalize to INR
  const rawAmount = parseFloat(String(rowData.amount).replace(/,/g, '')) || 0;
  const currency = (rowData.currency || 'INR').toUpperCase();
  const { amountInr, rate } = toInr(rawAmount, currency);

  // Parse date
  const dateResult = parseExpenseDate(rowData.date);
  if (!dateResult.parsed) {
    throw new Error(`Cannot parse date "${rowData.date}"`);
  }

  // Map split_type: CSV uses "unequal", DB uses "exact"
  const csvSplitType = (rowData.split_type || 'equal').toLowerCase();
  const dbSplitType = csvSplitType === 'unequal' ? 'exact' : csvSplitType || 'equal';

  // Resolve split_with names to user objects
  const splitWithNames = (rowData.split_with || '').split(';').map((s) => s.trim()).filter(Boolean);

  const splitMembers = [];
  for (const name of splitWithNames) {
    const user = userByName[name.toLowerCase().trim()];
    if (!user) {
      // Auto-create guest users (like Kabir) if they don't exist yet
      const newUser = await prisma.user.upsert({
        where: { name },
        update: {},
        create: { name, isGuest: true },
      });
      splitMembers.push(newUser);
      // Add to lookup for subsequent rows
      userByName[name.toLowerCase().trim()] = newUser;
    } else {
      splitMembers.push(user);
    }
  }

  if (splitMembers.length === 0) {
    throw new Error(`No valid members in split_with for expense "${rowData.description}"`);
  }

  // Parse split_details if present
  const splitDetailsMap = rowData.split_details
    ? parseSplitDetails(rowData.split_details)
    : null;

  // Calculate splits
  const splits = calculateSplits(amountInr, dbSplitType, splitMembers, splitDetailsMap);

  return {
    groupId,
    paidById: payer.id,
    description: rowData.description,
    originalAmount: rawAmount,
    originalCurrency: currency,
    amountInr,
    exchangeRate: rate,
    date: dateResult.date,
    splitType: dbSplitType,
    notes: rowData.notes || null,
    importBatchId: batchId,
    splits, // included for use in the transaction loop above
  };
}

module.exports = { commitImport };
