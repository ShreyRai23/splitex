// =============================================================================
// src/controllers/expenses.controller.js — Manual expense CRUD
//
// Supports all 4 split types: equal, percentage, exact (unequal), share.
// Idempotency key is checked before reaching the controller via middleware.
// =============================================================================

const prisma = require('../config/db');
const { CreateExpenseSchema, UpdateExpenseSchema } = require('../validators/expense.validator');
const { calculateSplits } = require('../services/split-calculator.service');
const { toInr } = require('../config/exchange-rates');
const { createError } = require('../middleware/error.middleware');
const { checkGroupMembership } = require('../middleware/authz.middleware');

async function createExpense(req, res) {
  const data = CreateExpenseSchema.parse(req.body);

  await checkGroupMembership(data.groupId, req.user.id);

  // Normalize foreign currency to INR
  const { amountInr, rate } = toInr(data.amount, data.currency);

  // Resolve member IDs to user objects (needed for calculateSplits)
  const members = await prisma.user.findMany({
    where: { id: { in: data.splitWith } },
    select: { id: true, name: true },
  });

  if (members.length !== data.splitWith.length) {
    const found = members.map((m) => m.id);
    const missing = data.splitWith.filter((id) => !found.includes(id));
    throw createError(404, `Users not found: ${missing.join(', ')}`);
  }

  // Calculate how much each member owes
  const splits = calculateSplits(amountInr, data.splitType, members, data.splitDetails || null);

  // Write inside a transaction — expense + all splits atomically
  const expense = await prisma.$transaction(async (tx) => {
    const created = await tx.expense.create({
      data: {
        groupId:          data.groupId,
        paidById:         data.paidById,
        description:      data.description,
        originalAmount:   data.amount,
        originalCurrency: data.currency,
        amountInr,
        exchangeRate:     rate,
        date:             new Date(data.date),
        splitType:        data.splitType,
        notes:            data.notes || null,
        idempotencyKey:   req.idempotencyKey || null,
      },
    });

    await tx.expenseSplit.createMany({
      data: splits.map((s) => ({
        expenseId:   created.id,
        userId:      s.userId,
        shareAmount: s.shareAmount,
        shareRatio:  s.shareRatio,
      })),
    });

    await tx.auditLog.create({
      data: {
        userId:     req.user?.id || null,
        action:     'EXPENSE_CREATED',
        targetType: 'Expense',
        targetId:   String(created.id),
        detail: {
          description: data.description,
          amount: data.amount,
          currency: data.currency,
          amountInr,
          splitType: data.splitType,
        },
      },
    });

    return created;
  });

  // Return the full expense with splits
  const full = await prisma.expense.findUnique({
    where: { id: expense.id },
    include: {
      paidBy: { select: { id: true, name: true } },
      splits: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  res.status(201).json({ data: full });
}

async function listExpenses(req, res) {
  const { groupId, page = 1, limit = 50 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  if (groupId) {
    await checkGroupMembership(parseInt(groupId), req.user.id);
  }

  const where = groupId ? { groupId: parseInt(groupId) } : {
    group: { memberships: { some: { userId: req.user.id } } }
  };

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: {
        paidBy: { select: { id: true, name: true } },
        splits: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { date: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.expense.count({ where }),
  ]);

  res.json({ data: expenses, total, page: parseInt(page), limit: parseInt(limit) });
}

async function getExpense(req, res) {
  const id = parseInt(req.params.id);
  const expense = await prisma.expense.findUnique({
    where: { id },
    include: {
      paidBy: { select: { id: true, name: true } },
      splits: { include: { user: { select: { id: true, name: true } } } },
      group:  { select: { id: true, name: true } },
    },
  });
  if (!expense) throw createError(404, `Expense #${id} not found`);
  await checkGroupMembership(expense.groupId, req.user.id);
  res.json({ data: expense });
}

async function updateExpense(req, res) {
  const id = parseInt(req.params.id);
  const data = UpdateExpenseSchema.parse(req.body);

  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) throw createError(404, `Expense #${id} not found`);
  await checkGroupMembership(existing.groupId, req.user.id);

  // Store before-state for audit log
  const before = { ...existing };

  const updated = await prisma.$transaction(async (tx) => {
    // If amount or split changed, recalculate splits
    let splitsToUpdate = null;

    if (data.amount !== undefined || data.splitType !== undefined || data.splitWith || data.splitDetails !== undefined) {
      const amount = data.amount ?? parseFloat(existing.amountInr);
      const splitType = data.splitType ?? existing.splitType;
      const currency = data.currency ?? existing.originalCurrency;
      const { amountInr } = toInr(amount, currency);

      const splitWithIds = data.splitWith ?? (
        await prisma.expenseSplit.findMany({ where: { expenseId: id }, select: { userId: true } })
      ).map((s) => s.userId);

      const members = await tx.user.findMany({
        where: { id: { in: splitWithIds } },
        select: { id: true, name: true },
      });

      splitsToUpdate = calculateSplits(amountInr, splitType, members, data.splitDetails ?? null);

      // Delete old splits and recreate
      await tx.expenseSplit.deleteMany({ where: { expenseId: id } });
      await tx.expenseSplit.createMany({
        data: splitsToUpdate.map((s) => ({
          expenseId: id, userId: s.userId, shareAmount: s.shareAmount, shareRatio: s.shareRatio,
        })),
      });
    }

    const result = await tx.expense.update({
      where: { id },
      data: {
        ...(data.description && { description: data.description }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.date && { date: new Date(data.date) }),
        ...(data.amount && {
          originalAmount: data.amount,
          amountInr: toInr(data.amount, data.currency ?? existing.originalCurrency).amountInr,
        }),
      },
    });

    await tx.auditLog.create({
      data: {
        userId:     req.user?.id || null,
        action:     'EXPENSE_UPDATED',
        targetType: 'Expense',
        targetId:   String(id),
        detail: { before, after: data },
      },
    });

    return result;
  });

  const full = await prisma.expense.findUnique({
    where: { id },
    include: {
      paidBy: { select: { id: true, name: true } },
      splits: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  res.json({ data: full });
}

async function deleteExpense(req, res) {
  const id = parseInt(req.params.id);
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) throw createError(404, `Expense #${id} not found`);
  await checkGroupMembership(existing.groupId, req.user.id);

  await prisma.$transaction(async (tx) => {
    await tx.expenseSplit.deleteMany({ where: { expenseId: id } });
    await tx.expense.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        userId:     req.user?.id || null,
        action:     'EXPENSE_DELETED',
        targetType: 'Expense',
        targetId:   String(id),
        detail: { description: existing.description, amount: existing.amountInr },
      },
    });
  });

  res.json({ message: `Expense #${id} deleted successfully` });
}

module.exports = { createExpense, listExpenses, getExpense, updateExpense, deleteExpense };
