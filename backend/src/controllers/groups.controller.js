// =============================================================================
// src/controllers/groups.controller.js
// =============================================================================

const prisma = require('../config/db');
const { CreateGroupSchema, AddMemberSchema, UpdateMemberSchema } = require('../validators/group.validator');
const { createError } = require('../middleware/error.middleware');

async function createGroup(req, res) {
  const data = CreateGroupSchema.parse(req.body);

  const group = await prisma.group.create({
    data: { 
      name: data.name,
      memberships: {
        create: data.members.map(userId => ({ userId, joinedAt: new Date() }))
      }
    },
    include: { memberships: true }
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user?.id || null,
      action: 'GROUP_CREATED',
      targetType: 'Group',
      targetId: String(group.id),
      detail: { name: group.name },
    },
  });

  res.status(201).json({ data: group });
}

async function listGroups(req, res) {
  const userId = req.user.id;
  const groups = await prisma.group.findMany({
    where: {
      memberships: {
        some: { userId }
      }
    },
    include: {
      memberships: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { joinedAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ 
    data: groups.map(g => ({ ...g, members: g.memberships })), 
    count: groups.length 
  });
}

async function getGroup(req, res) {
  const id = parseInt(req.params.id);
  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      memberships: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });
  if (!group) throw createError(404, `Group #${id} not found`);

  const isMember = group.memberships.some(m => m.userId === req.user.id);
  if (!isMember) throw createError(403, `You do not have access to this group`);

  res.json({ data: { ...group, members: group.memberships } });
}

async function addMember(req, res) {
  const groupId = parseInt(req.params.id);
  const data = AddMemberSchema.parse(req.body);

  // Check the group exists
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw createError(404, `Group #${groupId} not found`);

  // Check the user exists
  const user = await prisma.user.findUnique({ where: { id: data.userId } });
  if (!user) throw createError(404, `User #${data.userId} not found`);

  // Check for duplicate active membership
  const existing = await prisma.groupMembership.findFirst({
    where: { userId: data.userId, groupId, leftAt: null },
  });
  if (existing) throw createError(409, `User "${user.name}" is already an active member of this group`);

  const membership = await prisma.groupMembership.create({
    data: {
      userId: data.userId,
      groupId,
      joinedAt: new Date(data.joinedAt),
    },
    include: { user: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user?.id || null,
      action: 'MEMBER_ADDED',
      targetType: 'GroupMembership',
      targetId: String(membership.id),
      detail: { groupId, userId: data.userId, joinedAt: data.joinedAt },
    },
  });

  res.status(201).json({ data: membership });
}

async function updateMember(req, res) {
  const groupId = parseInt(req.params.id);
  const userId = parseInt(req.params.userId);
  const data = UpdateMemberSchema.parse(req.body);

  // Find the active membership
  const membership = await prisma.groupMembership.findFirst({
    where: { userId, groupId, leftAt: null },
  });

  if (!membership) {
    throw createError(404, `No active membership found for user #${userId} in group #${groupId}`);
  }

  const updated = await prisma.groupMembership.update({
    where: { id: membership.id },
    data: { leftAt: new Date(data.leftAt) },
    include: { user: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user?.id || null,
      action: 'MEMBER_LEFT',
      targetType: 'GroupMembership',
      targetId: String(membership.id),
      detail: { groupId, userId, leftAt: data.leftAt },
    },
  });

  res.json({ data: updated, message: `${updated.user.name} marked as left on ${data.leftAt}` });
}

module.exports = { createGroup, listGroups, getGroup, addMember, updateMember };
