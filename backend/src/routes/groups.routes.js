// src/routes/groups.routes.js
const { Router } = require('express');
const { createGroup, listGroups, getGroup, addMember, updateMember } = require('../controllers/groups.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const router = Router();

router.post('/',                         requireAuth, createGroup);
router.get('/',                          requireAuth, listGroups);
router.get('/:id',                       requireAuth, getGroup);
router.post('/:id/members',              requireAuth, addMember);
router.patch('/:id/members/:userId',     requireAuth, updateMember);

module.exports = router;
