// =============================================================================
// src/controllers/settlements.controller.js
// =============================================================================

const prisma = require('../config/db');
const { CreateSettlementSchema } = require('../validators/expense.validator');
const { toInr } = require('../config/exchange-rates');
const { createError } = require('../middleware/error.middleware');

async function createSettlement(req, res) {
  const data = CreateSettlementSchema.parse(req.body);

  if (req.user.id !== data.payerId && req.user.id !== data.payeeId) {
    throw createError(403, 'You must be either the payer or payee to record a settlement');
  }

  const { amountInr } = toInr(data.amount, data.currency);

  const settlement = await prisma.$transaction(async (tx) => {
    const s = await tx.settlement.create({
      data: {
        payerId:  data.payerId,
        payeeId:  data.payeeId,
        amount:   data.amount,
        currency: data.currency,
        amountInr,
        method:   data.method,
        date:     new Date(data.date),
        note:     data.note || null,
      },
      include: {
        payer: { select: { id: true, name: true } },
        payee: { select: { id: true, name: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        userId:     req.user?.id || null,
        action:     'SETTLEMENT_CREATED',
        targetType: 'Settlement',
        targetId:   String(s.id),
        detail: {
          payerName: s.payer.name,
          payeeName: s.payee.name,
          amount: data.amount,
          currency: data.currency,
          amountInr,
        },
      },
    });

    return s;
  });

  res.status(201).json({ data: settlement });
}

async function listSettlements(req, res) {
  const { userId } = req.query;
  const targetId = userId ? parseInt(userId) : req.user.id;
  
  if (userId && targetId !== req.user.id) {
    throw createError(403, 'You can only view your own settlements');
  }

  const where = { OR: [{ payerId: targetId }, { payeeId: targetId }] };

  const settlements = await prisma.settlement.findMany({
    where,
    include: {
      payer: { select: { id: true, name: true } },
      payee: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
  });

  res.json({ data: settlements, count: settlements.length });
}

async function getSettlement(req, res) {
  const id = parseInt(req.params.id);
  const settlement = await prisma.settlement.findUnique({
    where: { id },
    include: {
      payer: { select: { id: true, name: true } },
      payee: { select: { id: true, name: true } },
    },
  });
  if (!settlement) throw createError(404, `Settlement #${id} not found`);

  if (settlement.payerId !== req.user.id && settlement.payeeId !== req.user.id) {
    throw createError(403, 'You do not have access to this settlement');
  }

  res.json({ data: settlement });
}

module.exports = { createSettlement, listSettlements, getSettlement };
