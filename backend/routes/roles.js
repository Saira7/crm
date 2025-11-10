const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');
const prisma = new PrismaClient();
const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const roles = await prisma.role.findMany();
  res.json(roles);
});

router.post('/', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { name } = req.body;
  const role = await prisma.role.create({ data: { name } });
  res.json(role);
});

module.exports = router;
