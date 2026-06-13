// =============================================================================
// src/controllers/users.controller.js
// =============================================================================

const prisma = require('../config/db');
const { createError } = require('../middleware/error.middleware');

async function listUsers(req, res) {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, isGuest: true, createdAt: true },
    orderBy: { name: 'asc' },
  });
  res.json({ data: users, count: users.length });
}

async function getUser(req, res) {
  const id = parseInt(req.params.id);
  const includeMemberships = req.user?.id === id;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, isGuest: true, createdAt: true,
              ...(includeMemberships && { memberships: { include: { group: true } } }) },
  });
  if (!user) throw createError(404, `User #${id} not found`);
  res.json({ data: user });
}

module.exports = { listUsers, getUser };
