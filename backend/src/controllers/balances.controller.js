// =============================================================================
// src/controllers/balances.controller.js
// =============================================================================

const { getGroupBalances, getUserItemizedBalance } = require('../services/balance.service');
const { createError } = require('../middleware/error.middleware');
const { checkGroupMembership } = require('../middleware/authz.middleware');

async function groupBalances(req, res) {
  const groupId = parseInt(req.params.groupId);
  if (isNaN(groupId)) throw createError(400, 'groupId must be a number');

  await checkGroupMembership(groupId, req.user.id);

  const balances = await getGroupBalances(groupId);
  res.json({ data: balances });
}

async function userBalance(req, res) {
  const userId  = parseInt(req.params.userId);
  const groupId = parseInt(req.query.groupId);

  if (isNaN(userId))  throw createError(400, 'userId must be a number');
  if (isNaN(groupId)) throw createError(400, 'groupId query parameter is required');

  await checkGroupMembership(groupId, req.user.id);

  const balance = await getUserItemizedBalance(userId, groupId);
  res.json({ data: balance });
}

module.exports = { groupBalances, userBalance };
