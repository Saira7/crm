const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');
const prisma = new PrismaClient();
const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const teams = await prisma.team.findMany({ include: { members: true } });
  res.json(teams);
});

router.post('/', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { name } = req.body;
  const team = await prisma.team.create({ data: { name } });
  res.json(team);
});

router.post('/:teamId/add', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const teamId = parseInt(req.params.teamId);
  const { userId } = req.body;
  const user = await prisma.user.update({ where: { id: userId }, data: { teamId } });
  res.json(user);
});

module.exports = router;
