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
// PATCH /api/users/:id
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid user id' });

    // requester info (req.user may contain role as string or object)
    const requesterId = req.user?.userId;
    const reqRoleRaw = req.user?.role;
    const requesterRole = typeof reqRoleRaw === 'string' ? reqRoleRaw : (reqRoleRaw?.name || reqRoleRaw?.role || '');
    const requesterRoleNorm = String(requesterRole || '').toLowerCase();

    // load requester row to know teamId
    const requesterRow = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { id: true, teamId: true, roleId: true }
    });

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, teamId: true, roleId: true }
    });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const isAdmin = requesterRoleNorm === 'admin';
    const isOwner = requesterId === id;
    const isTeamLead = requesterRoleNorm === 'team lead' || requesterRoleNorm === 'team_lead' || requesterRoleNorm === 'team-lead';

    // DISALLOW owners (self) to update their account
    if (isOwner) {
      return res.status(403).json({ error: 'Users are not permitted to modify their own account via this endpoint' });
    }

    // Authorize: admin OR (team_lead && same team)
    if (!(isAdmin || (isTeamLead && requesterRow?.teamId && requesterRow.teamId === targetUser.teamId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const body = req.body || {};
    const data = {};

    // Allowed for team_lead (and admin): name, email, password
    if (body.name !== undefined) data.name = body.name || null;
    if (body.email !== undefined) data.email = body.email || null;

    if (body.password !== undefined) {
      if (body.password && String(body.password).length > 0) {
        const hashed = await bcrypt.hash(String(body.password), 10);
        data.password = hashed;
      } else {
        // empty password => ignore; do not set to empty string
      }
    }

    // ONLY admin can change role/team/ip related fields
    if (body.roleId !== undefined || body.teamId !== undefined || body.allowedIPs !== undefined || body.ipExempt !== undefined || body.ipRestricted !== undefined) {
      if (!isAdmin) return res.status(403).json({ error: 'Only admin can change role/team/IP settings' });

      if (body.roleId !== undefined) data.roleId = body.roleId || null;
      if (body.teamId !== undefined) data.teamId = body.teamId || null;
      if (body.allowedIPs !== undefined) data.allowedIPs = Array.isArray(body.allowedIPs) ? body.allowedIPs : [];
      if (body.ipExempt !== undefined) data.ipExempt = !!body.ipExempt;
      if (body.ipRestricted !== undefined) data.ipRestricted = !!body.ipRestricted;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided to update' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      include: { role: true, team: true }
    });

    res.json(updated);
  } catch (err) {
    console.error('users.patch error', err);
    if (err.code === 'P2002') return res.status(400).json({ error: 'Duplicate value' });
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const id = parseInt(req.params.id);
  await prisma.user.delete({ where: { id } });
  res.json({ success: true });
});

module.exports = router;
