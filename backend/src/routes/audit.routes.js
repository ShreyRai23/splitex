// src/routes/audit.routes.js
const { Router } = require('express');
const prisma = require('../config/db');
const { requireAuth } = require('../middleware/auth.middleware');
const router = Router();

// GET /api/audit-logs — paginated audit log for admins
router.get('/', requireAuth, async (req, res) => {
  const { page = 1, limit = 50, targetType, action } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {
    userId: req.user.id,
    ...(targetType && { targetType }),
    ...(action && { action }),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ data: logs, total, page: parseInt(page), limit: parseInt(limit) });
});

module.exports = router;
