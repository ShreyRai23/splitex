// src/routes/users.routes.js
const { Router } = require('express');
const { listUsers, getUser } = require('../controllers/users.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const router = Router();

router.get('/',    requireAuth, listUsers);
router.get('/:id', requireAuth, getUser);

module.exports = router;
