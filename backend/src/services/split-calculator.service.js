// =============================================================================
// src/services/split-calculator.service.js
//
// Computes the exact INR amount each person owes for a single expense, given
// the split type and split details. This is the arithmetic core of the app.
//
// All four split types are supported:
//   equal      — total / n, remainder distributed to first person
//   percentage — total * (pct / 100), validated to sum to 100%
//   exact      — raw rupee amounts per person, validated to sum to total
//   share      — weighted ratios (e.g., 2:1:1:1), proportional split
//
// Returns: Array of { userId, shareAmount, shareRatio }
// The shareRatio field preserves the original input value for audit trail.
// =============================================================================

const { createError } = require('../middleware/error.middleware');

/**
 * Calculate expense splits.
 *
 * @param {number} totalInr         - Total expense amount in INR
 * @param {'equal'|'percentage'|'exact'|'share'} splitType
 * @param {Array<{id: number, name: string}>} members - Users in the split
 * @param {Object|null} splitDetails - { [name]: value } map from input
 * @returns {Array<{userId, shareAmount, shareRatio}>}
 */
function calculateSplits(totalInr, splitType, members, splitDetails) {
  if (!members || members.length === 0) {
    throw createError(400, 'Cannot calculate splits: no members provided');
  }

  switch (splitType) {
    case 'equal':
      return calculateEqualSplit(totalInr, members);

    case 'percentage':
      return calculatePercentageSplit(totalInr, members, splitDetails);

    case 'exact':
      return calculateExactSplit(totalInr, members, splitDetails);

    case 'share':
      return calculateShareSplit(totalInr, members, splitDetails);

    default:
      throw createError(400, `Unknown split type: "${splitType}"`);
  }
}

// ---------------------------------------------------------------------------
// Equal Split
// Distributes evenly. Fractional remainders (paisa) go to the first person.
// This is the "collect from everyone" approach — deterministic and auditable.
// ---------------------------------------------------------------------------
function calculateEqualSplit(totalInr, members) {
  const n = members.length;
  const baseShare = Math.floor((totalInr * 100) / n) / 100; // floor to 2dp
  const remainder = parseFloat((totalInr - baseShare * n).toFixed(2));

  return members.map((member, index) => ({
    userId: member.id,
    // First person absorbs the rounding remainder
    shareAmount: index === 0 ? parseFloat((baseShare + remainder).toFixed(2)) : baseShare,
    shareRatio: parseFloat((1 / n).toFixed(4)), // e.g., 0.25 for 4 members
  }));
}

// ---------------------------------------------------------------------------
// Percentage Split
// Requires percentages to sum to 100 (±0.01 tolerance for floating point).
// ---------------------------------------------------------------------------
function calculatePercentageSplit(totalInr, members, splitDetails) {
  if (!splitDetails) {
    throw createError(400, 'splitDetails is required for percentage splits');
  }

  // Build name→user lookup (case-insensitive)
  const memberMap = buildNameMap(members);
  const results = [];
  let computedTotal = 0;

  for (const member of members) {
    const pct = findDetailValue(member.name, splitDetails);
    if (pct === null) {
      throw createError(
        400,
        `Missing percentage for "${member.name}" in splitDetails. Keys: ${Object.keys(splitDetails).join(', ')}`
      );
    }
    const shareAmount = parseFloat(((totalInr * pct) / 100).toFixed(2));
    computedTotal = parseFloat((computedTotal + shareAmount).toFixed(2));
    results.push({ userId: member.id, shareAmount, shareRatio: pct });
  }

  // Correct floating-point rounding discrepancy (assign to first member)
  const diff = parseFloat((totalInr - computedTotal).toFixed(2));
  if (diff !== 0) {
    results[0].shareAmount = parseFloat((results[0].shareAmount + diff).toFixed(2));
  }

  return results;
}

// ---------------------------------------------------------------------------
// Exact Split (called "unequal" in CSV — CSV row 12: birthday cake)
// Users specify the exact rupee amount each person owes.
// Must sum to total (±0.01 tolerance).
// ---------------------------------------------------------------------------
function calculateExactSplit(totalInr, members, splitDetails) {
  if (!splitDetails) {
    throw createError(400, 'splitDetails is required for exact splits');
  }

  const results = [];
  let computedTotal = 0;

  for (const member of members) {
    const exactAmount = findDetailValue(member.name, splitDetails);
    if (exactAmount === null) {
      throw createError(
        400,
        `Missing exact amount for "${member.name}" in splitDetails`
      );
    }
    const shareAmount = parseFloat(exactAmount.toFixed(2));
    computedTotal = parseFloat((computedTotal + shareAmount).toFixed(2));
    results.push({ userId: member.id, shareAmount, shareRatio: shareAmount });
  }

  if (Math.abs(computedTotal - totalInr) > 0.01) {
    throw createError(
      400,
      `Exact split amounts sum to ${computedTotal} but total is ${totalInr}. Difference: ${(totalInr - computedTotal).toFixed(2)}`
    );
  }

  return results;
}

// ---------------------------------------------------------------------------
// Share Split (weighted ratios — CSV row 22: scooter rentals 1:2:1:2)
// Converts ratios to proportional amounts.
// ---------------------------------------------------------------------------
function calculateShareSplit(totalInr, members, splitDetails) {
  if (!splitDetails) {
    throw createError(400, 'splitDetails is required for share splits');
  }

  const memberShares = members.map((member) => {
    const shareCount = findDetailValue(member.name, splitDetails);
    if (shareCount === null) {
      throw createError(400, `Missing share count for "${member.name}" in splitDetails`);
    }
    return { member, shareCount };
  });

  const totalShares = memberShares.reduce((sum, { shareCount }) => sum + shareCount, 0);
  if (totalShares <= 0) {
    throw createError(400, 'Total share count must be greater than 0');
  }

  const results = [];
  let computedTotal = 0;

  for (const { member, shareCount } of memberShares) {
    const shareAmount = parseFloat(((totalInr * shareCount) / totalShares).toFixed(2));
    computedTotal = parseFloat((computedTotal + shareAmount).toFixed(2));
    results.push({ userId: member.id, shareAmount, shareRatio: shareCount });
  }

  // Fix rounding remainder
  const diff = parseFloat((totalInr - computedTotal).toFixed(2));
  if (diff !== 0) {
    results[0].shareAmount = parseFloat((results[0].shareAmount + diff).toFixed(2));
  }

  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a case-insensitive name→user map */
function buildNameMap(members) {
  return Object.fromEntries(members.map((m) => [m.name.toLowerCase(), m]));
}

/**
 * Find a value in splitDetails by name, case-insensitively.
 * Handles slight name mismatches (e.g., "priya" vs "Priya").
 */
function findDetailValue(memberName, splitDetails) {
  const lower = memberName.toLowerCase().trim();

  for (const [key, value] of Object.entries(splitDetails)) {
    if (key.toLowerCase().trim() === lower) {
      return value;
    }
  }
  return null;
}

module.exports = { calculateSplits };
