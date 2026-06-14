// src/routes/expenses.routes.js
const { Router } = require('express');
const {
  createExpense, listExpenses, getExpense, updateExpense, deleteExpense,
} = require('../controllers/expenses.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { idempotencyCheck } = require('../middleware/idempotency.middleware');
const router = Router();

// idempotencyCheck runs before createExpense to short-circuit duplicate POSTs
router.post('/',    requireAuth, idempotencyCheck, createExpense);
router.get('/',     requireAuth, listExpenses);
router.get('/:id',  requireAuth, getExpense);
router.patch('/:id',requireAuth, updateExpense);
router.delete('/:id',requireAuth, deleteExpense);

module.exports = router;
