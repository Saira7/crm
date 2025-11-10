const express = require('express');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');
const prisma = new PrismaClient();
const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const users = await prisma.user.findMany({ include: { role: true, team: true } });
  res.json(users);
});

router.post('/', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { name, email, password, roleId, teamId, ipAddress } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { name, email, password: hashed, roleId, teamId, ipAddress } });
  res.json(user);
});

router.put('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (req.user.role !== 'admin' && req.user.userId !== id) return res.status(403).json({ error: 'Forbidden' });
  const { name, email, roleId, teamId, ipAddress } = req.body;
  const user = await prisma.user.update({ where: { id }, data: { name, email, roleId, teamId, ipAddress } });
  res.json(user);
});

router.delete('/:id', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const id = parseInt(req.params.id);
  await prisma.user.delete({ where: { id } });
  res.json({ success: true });
});

module.exports = router;
