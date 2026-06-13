// src/middleware/authz.middleware.js
const prisma = require('../config/db');
const { createError } = require('./error.middleware');

async function checkGroupMembership(groupId, userId) {
  if (!groupId) throw createError(400, 'groupId is required for authorization');
  
  const membership = await prisma.groupMembership.findFirst({
    where: { groupId, userId, leftAt: null }
  });

  if (!membership) {
    throw createError(403, `You do not have access to group #${groupId}`);
  }
  return membership;
}

module.exports = { checkGroupMembership };
