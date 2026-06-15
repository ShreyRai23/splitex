// =============================================================================
// src/services/debt-simplifier.service.js — Greedy Minimum-Transactions Algorithm
//
// Problem: Given a set of net balances (who owes whom how much), find the
// minimum number of peer-to-peer transfers needed to settle all debts.
//
// Algorithm:
//   1. Compute net balance for each user:
//      net[user] = total_owed_by_others_to_user - total_owed_by_user_to_others
//      Positive net = creditor (others owe them)
//      Negative net = debtor (they owe others)
//
//   2. Use a greedy approach with two sorted lists (creditors & debtors):
//      - Pick the biggest creditor and biggest debtor
//      - Transfer min(debt, credit) from debtor to creditor
//      - Remove whichever reaches zero, repeat
//
//   This produces the minimum number of transactions (upper bound = n-1).
//   Time complexity: O(n log n)
//
// Example:
//   A owes B ₹100, B owes C ₹100
//   Net: A = -100, B = 0, C = +100
//   Result: A pays C ₹100 (1 transaction instead of 2)
//
// This satisfies Aisha's requirement: "Who pays whom, how much, done."
// =============================================================================

/**
 * Simplify debts into the minimum set of transactions.
 *
 * @param {Array<{from: number, to: number, amount: number}>} rawDebts
 *   Array of raw debt edges (from userId owes to userId, amount in INR)
 * @param {Object} userMap - { [userId]: { id, name } } for readable output
 * @returns {Array<{payer: Object, payee: Object, amount: number}>}
 *   Minimum set of settlements needed
 */
function simplifyDebts(rawDebts, userMap) {
  // -------------------------------------------------------------------------
  // Step 1: Compute net balance per user
  // -------------------------------------------------------------------------
  const netBalance = {}; // { [userId]: number } — positive = creditor

  for (const debt of rawDebts) {
    if (!netBalance[debt.from]) netBalance[debt.from] = 0;
    if (!netBalance[debt.to])   netBalance[debt.to] = 0;

    netBalance[debt.from] -= debt.amount; // debtor loses
    netBalance[debt.to]   += debt.amount; // creditor gains
  }

  // -------------------------------------------------------------------------
  // Step 2: Separate into creditors (positive) and debtors (negative)
  // Use arrays sorted by magnitude for the greedy matching
  // -------------------------------------------------------------------------
  const creditors = []; // { userId, amount } — sorted descending
  const debtors   = []; // { userId, amount } — sorted descending (by abs value)

  for (const [userId, balance] of Object.entries(netBalance)) {
    const roundedBalance = Math.round(balance * 100) / 100; // avoid floating-point noise
    if (roundedBalance > 0.009) {         // tiny positive — creditor
      creditors.push({ userId: parseInt(userId), amount: roundedBalance });
    } else if (roundedBalance < -0.009) { // tiny negative — debtor
      debtors.push({ userId: parseInt(userId), amount: Math.abs(roundedBalance) });
    }
    // Zero-balance users are settled — skip them
  }

  // Sort descending by amount for greedy efficiency
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  // -------------------------------------------------------------------------
  // Step 3: Greedy matching loop
  // -------------------------------------------------------------------------
  const transactions = [];

  let ci = 0; // creditor index
  let di = 0; // debtor index

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor   = debtors[di];

    // Transfer amount = min(what debtor owes, what creditor is owed)
    const transferAmount = Math.min(creditor.amount, debtor.amount);
    const rounded = Math.round(transferAmount * 100) / 100;

    if (rounded > 0) {
      transactions.push({
        payer:  userMap[debtor.userId]   || { id: debtor.userId,   name: `User#${debtor.userId}` },
        payee:  userMap[creditor.userId] || { id: creditor.userId, name: `User#${creditor.userId}` },
        amount: rounded,
      });
    }

    // Reduce both balances
    creditor.amount = Math.round((creditor.amount - transferAmount) * 100) / 100;
    debtor.amount   = Math.round((debtor.amount   - transferAmount) * 100) / 100;

    // Advance pointer for whichever reached zero
    if (creditor.amount < 0.009) ci++;
    if (debtor.amount   < 0.009) di++;
  }

  return transactions;
}

/**
 * Build a raw debt list from ExpenseSplit data.
 * For each expense split, the payer is owed money by each member (excluding the payer themselves).
 *
 * @param {Array<Object>} expenses - Expense objects with splits and paidBy
 * @param {Array<Object>} settlements - Settlement objects (already-paid debts)
 * @returns {Array<{from: number, to: number, amount: number}>}
 */
function buildRawDebts(expenses, settlements) {
  const debts = [];

  // Each ExpenseSplit means: split.userId owes expense.paidById split.shareAmount
  for (const expense of expenses) {
    for (const split of expense.splits || []) {
      // The payer doesn't owe themselves
      if (split.userId === expense.paidById) continue;

      debts.push({
        from:   split.userId,       // owes money
        to:     expense.paidById,   // paid and is owed
        amount: parseFloat(split.shareAmount),
      });
    }
  }

  // Settlements REDUCE debts (subtract from the raw debt graph)
  for (const settlement of settlements) {
    // A settlement where payer→payee means: payer paid payee, so payee's IOU is reduced
    debts.push({
      from:   settlement.payeeId,  // payee's outstanding claim is reduced
      to:     settlement.payerId,  // payer gets credit
      amount: parseFloat(settlement.amountInr),
    });
    // Note: this works because the algorithm uses net balances.
    // The settlement effectively moves money the other direction in the debt graph.
  }

  return debts;
}

module.exports = { simplifyDebts, buildRawDebts };
