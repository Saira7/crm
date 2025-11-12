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

    // Get requester info
    const requesterId = req.user?.userId;
    const reqRoleRaw = req.user?.role;
    const requesterRole = typeof reqRoleRaw === 'string' ? reqRoleRaw : (reqRoleRaw?.name || reqRoleRaw?.role || '');
    const requesterRoleNorm = String(requesterRole || '').toLowerCase();

    // Get requester and target user data
    const requesterRow = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { id: true, teamId: true, roleId: true }
    });

    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: { role: true, team: true }
    });
    
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const isAdmin = requesterRoleNorm === 'admin';
    const isOwner = requesterId === id;
    const isTeamLead = requesterRoleNorm === 'team lead' || requesterRoleNorm === 'team_lead' || requesterRoleNorm === 'team-lead';

    // Check permissions
    if (isOwner) {
      return res.status(403).json({ error: 'You cannot edit your own account' });
    }

    if (!(isAdmin || (isTeamLead && requesterRow?.teamId && requesterRow.teamId === targetUser.teamId))) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const body = req.body || {};
    const data = {};

    // Validate and prepare update data
    if (body.name !== undefined) {
      if (!body.name || body.name.trim().length === 0) {
        return res.status(400).json({ error: 'Name cannot be empty' });
      }
      data.name = body.name.trim();
    }

    if (body.email !== undefined) {
      if (!body.email || body.email.trim().length === 0) {
        return res.status(400).json({ error: 'Email cannot be empty' });
      }
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email.trim())) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      data.email = body.email.trim();
    }

    // Handle password
    if (body.password !== undefined && body.password && body.password.trim().length > 0) {
      if (body.password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      data.password = await bcrypt.hash(body.password, 10);
    }

    // Admin-only fields
    if (isAdmin) {
      if (body.roleId !== undefined) {
        if (body.roleId === null || body.roleId === '') {
          data.roleId = null;
        } else {
          const roleExists = await prisma.role.findUnique({ where: { id: body.roleId } });
          if (!roleExists) return res.status(400).json({ error: 'Invalid role ID' });
          data.roleId = body.roleId;
        }
      }

      if (body.teamId !== undefined) {
        if (body.teamId === null || body.teamId === '') {
          data.teamId = null;
        } else {
          const teamExists = await prisma.team.findUnique({ where: { id: body.teamId } });
          if (!teamExists) return res.status(400).json({ error: 'Invalid team ID' });
          data.teamId = body.teamId;
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Perform update
    const updated = await prisma.user.update({
      where: { id },
      data,
      include: { role: true, team: true }
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = updated;
    res.json(userWithoutPassword);

  } catch (err) {
    console.error('PATCH /api/users/:id error:', err);
    
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const id = parseInt(req.params.id);
  await prisma.user.delete({ where: { id } });
  res.json({ success: true });
});

module.exports = router;
