// src/routes/settlements.routes.js
const { Router } = require('express');
const { createSettlement, listSettlements, getSettlement } = require('../controllers/settlements.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const router = Router();

router.post('/',    requireAuth, createSettlement);
router.get('/',     requireAuth, listSettlements);
router.get('/:id',  requireAuth, getSettlement);

module.exports = router;
