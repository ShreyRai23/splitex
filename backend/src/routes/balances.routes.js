// src/routes/balances.routes.js
const { Router } = require('express');
const { groupBalances, userBalance } = require('../controllers/balances.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const router = Router();

// GET /api/balances/group/:groupId → simplified debt for the group
router.get('/group/:groupId', requireAuth, groupBalances);

// GET /api/balances/user/:userId?groupId=1 → itemized breakdown for one user
router.get('/user/:userId',   requireAuth, userBalance);

module.exports = router;
