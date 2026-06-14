// =============================================================================
// src/services/balance.service.js — Balance computation with full auditability
//
// Satisfies TWO user requirements simultaneously:
//   Aisha: "One number per person. Who pays whom, how much."
//          → simplifiedDebts output from simplifyDebts()
//
//   Rohan: "No magic numbers. If the app says I owe ₹2,300, I want to see
//           exactly which expenses make that up."
//          → itemizedBalance output: per-expense breakdown
//
// Architecture:
//   We compute balances purely from ExpenseSplit + Settlement records in the DB.
//   There is NO cached "balance" column anywhere. Every number is derived fresh
//   from the source records, making it trivially auditable.
// =============================================================================

const prisma = require('../config/db');
const { simplifyDebts, buildRawDebts } = require('./debt-simplifier.service');

/**
 * Get the simplified debt summary for an entire group.
 * Returns: who pays whom, how much (Aisha's view).
 *
 * @param {number} groupId
 * @returns {Promise<Object>}
 */
async function getGroupBalances(groupId) {
  const { expenses, settlements, members } = await fetchGroupData(groupId);

  // Build user lookup map
  const userMap = Object.fromEntries(members.map((m) => [m.userId, m.user]));

  // Build raw debt graph and simplify
  const rawDebts = buildRawDebts(expenses, settlements);
  const simplified = simplifyDebts(rawDebts, userMap);

  // Also compute net balance per user (for the summary table)
  const netBalances = computeNetBalances(expenses, settlements, members);

  return {
    groupId,
    groupName: expenses[0]?.group?.name || '',
    summary: netBalances, // { userId, name, balance } — positive = owed to them
    simplifiedTransactions: simplified, // minimum settlement instructions
    rawExpenseCount: expenses.length,
    rawSettlementCount: settlements.length,
  };
}

/**
 * Get the itemized balance for a single user — Rohan's "no magic numbers" view.
 * Returns the complete breakdown of every expense contributing to their balance.
 *
 * @param {number} userId
 * @param {number} groupId
 * @returns {Promise<Object>}
 */
async function getUserItemizedBalance(userId, groupId) {
  // Fetch all expenses where this user has a split share
  const userSplits = await prisma.expenseSplit.findMany({
    where: { 
      userId,
      expense: { groupId }
    },
    include: {
      expense: {
        include: {
          paidBy: { select: { id: true, name: true } },
          group:  { select: { id: true, name: true } },
        },
      },
    },
  });

  // Expenses where this user PAID (others owe them)
  const expensesPaid = await prisma.expense.findMany({
    where: { paidById: userId, groupId },
    include: {
      splits: {
        include: { user: { select: { id: true, name: true } } },
        where: { userId: { not: userId } }, // exclude self-split
      },
    },
  });

  // Settlements involving this user
  const sentSettlements = await prisma.settlement.findMany({
    where: { payerId: userId },
    include: { payee: { select: { id: true, name: true } } },
  });

  const receivedSettlements = await prisma.settlement.findMany({
    where: { payeeId: userId },
    include: { payer: { select: { id: true, name: true } } },
  });

  // -------------------------------------------------------------------------
  // Build the itemized breakdown
  // -------------------------------------------------------------------------

  // Amounts this user OWES (they are in the split, someone else paid)
  const owes = userSplits
    .filter((s) => s.expense && s.expense.paidById !== userId)
    .map((s) => ({
      expenseId:   s.expense.id,
      description: s.expense.description,
      date:        s.expense.date,
      paidBy:      s.expense.paidBy,
      shareAmount: parseFloat(s.shareAmount),
      splitType:   s.expense.splitType,
      shareRatio:  parseFloat(s.shareRatio),
      currency:    s.expense.originalCurrency,
    }));

  // Amounts this user IS OWED (they paid, others have splits)
  const isOwed = expensesPaid.flatMap((e) =>
    e.splits.map((s) => ({
      expenseId:   e.id,
      description: e.description,
      date:        e.date,
      owedBy:      s.user,
      shareAmount: parseFloat(s.shareAmount),
      splitType:   e.splitType,
    }))
  );

  // Compute totals
  const totalOwed       = owes.reduce((sum, o) => sum + o.shareAmount, 0);
  const totalIsOwed     = isOwed.reduce((sum, o) => sum + o.shareAmount, 0);
  const totalPaidOut    = sentSettlements.reduce((sum, s) => sum + parseFloat(s.amountInr), 0);
  const totalReceivedIn = receivedSettlements.reduce((sum, s) => sum + parseFloat(s.amountInr), 0);

  // Net balance: positive = others owe you, negative = you owe others
  const netBalance = totalIsOwed - totalOwed + totalReceivedIn - totalPaidOut;

  return {
    userId,
    netBalance: parseFloat(netBalance.toFixed(2)),
    interpretation: netBalance > 0
      ? `Others owe you ₹${netBalance.toFixed(2)}`
      : netBalance < 0
      ? `You owe ₹${Math.abs(netBalance).toFixed(2)}`
      : 'Fully settled',
    breakdown: {
      amountsYouOwe:      { total: parseFloat(totalOwed.toFixed(2)),       items: owes },
      amountsOwedToYou:   { total: parseFloat(totalIsOwed.toFixed(2)),     items: isOwed },
      settlementsYouMade: { total: parseFloat(totalPaidOut.toFixed(2)),    items: sentSettlements },
      settlementsReceived:{ total: parseFloat(totalReceivedIn.toFixed(2)), items: receivedSettlements },
    },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function fetchGroupData(groupId) {
  const [expenses, settlements, memberships] = await Promise.all([
    prisma.expense.findMany({
      where: { groupId },
      include: {
        splits: true,
        paidBy: { select: { id: true, name: true } },
        group:  { select: { id: true, name: true } },
      },
    }),
    prisma.settlement.findMany({
      // Only include settlements between group members
      // (we don't filter by groupId — settlements are cross-group)
      include: {
        payer: { select: { id: true, name: true } },
        payee: { select: { id: true, name: true } },
      },
    }),
    prisma.groupMembership.findMany({
      where: { groupId },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  const members = memberships.map((m) => ({
    userId: m.userId,
    user: m.user,
    joinedAt: m.joinedAt,
    leftAt: m.leftAt,
  }));

  return { expenses, settlements, members };
}

function computeNetBalances(expenses, settlements, members) {
  const balances = {};

  // Initialize all members
  for (const m of members) {
    balances[m.userId] = { userId: m.userId, name: m.user.name, balance: 0 };
  }

  // Process expense splits
  for (const expense of expenses) {
    for (const split of expense.splits) {
      if (split.userId === expense.paidById) continue;

      const splitAmount = parseFloat(split.shareAmount);

      // Debtor owes more
      if (balances[split.userId]) {
        balances[split.userId].balance -= splitAmount;
      }
      // Creditor is owed more
      if (balances[expense.paidById]) {
        balances[expense.paidById].balance += splitAmount;
      }
    }
  }

  // Process settlements (reduce balances)
  for (const s of settlements) {
    const amount = parseFloat(s.amountInr);
    if (balances[s.payerId]) balances[s.payerId].balance += amount; // payer gets credit
    if (balances[s.payeeId]) balances[s.payeeId].balance -= amount; // payee's claim reduced
  }

  return Object.values(balances).map((b) => ({
    ...b,
    balance: parseFloat(b.balance.toFixed(2)),
  }));
}

module.exports = { getGroupBalances, getUserItemizedBalance };
