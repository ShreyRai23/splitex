// =============================================================================
// src/controllers/auth.controller.js
// =============================================================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { RegisterUserSchema, LoginSchema } = require('../validators/group.validator');
const { createError } = require('../middleware/error.middleware');

async function register(req, res) {
  const data = RegisterUserSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw createError(409, 'Email already registered');

  const existingName = await prisma.user.findUnique({ where: { name: data.name } });
  if (existingName) throw createError(409, 'Username already taken');

  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: { name: data.name, email: data.email, passwordHash },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  const token = signToken(user);

  await prisma.auditLog.create({
    data: { userId: user.id, action: 'USER_REGISTERED', targetType: 'User', targetId: String(user.id) },
  });

  res.status(201).json({ token, user });
}

async function login(req, res) {
  const data = LoginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user || !user.passwordHash) throw createError(401, 'Invalid email or password');

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) throw createError(401, 'Invalid email or password');

  const token = signToken(user);

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email },
  });
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

module.exports = { register, login };
