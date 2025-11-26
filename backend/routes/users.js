// backend/routes/users.js
const express = require('express');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');

const prisma = new PrismaClient();
const router = express.Router();

/**
 * Helper to normalize a role string, e.g. "Team Lead" -> "team_lead".
 */
function normalizeRole(role) {
  if (!role) return '';
  const r = String(typeof role === 'string' ? role : role.name || '').toLowerCase().trim();
  return r.replace(/\s+/g, '_');
}

/**
 * GET /api/users
 * Returns all users with role & team included.
 * Access: any authenticated user (frontend filters per-role).
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { role: true, team: true },
      orderBy: { id: 'asc' },
    });

    // strip password
    const safeUsers = users.map(({ password, ...u }) => u);
    res.json(safeUsers);
  } catch (err) {
    console.error('GET /api/users error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/users
 * Create a new user.
 * Access:
 *   - admin: can create any user, any team
 *   - team_lead: can create non-admin users ONLY in their own team
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const requesterId = req.user?.userId;
    const requesterRoleNorm = normalizeRole(req.user?.role);

    const isAdmin = requesterRoleNorm === 'admin';
    const isTeamLead =
      requesterRoleNorm === 'team_lead' ||
      requesterRoleNorm === 'team-lead';

    if (!isAdmin && !isTeamLead) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { name, email, password, roleId, teamId } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (!roleId) {
      return res.status(400).json({ error: 'roleId is required' });
    }

    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      return res.status(400).json({ error: 'Invalid roleId' });
    }
    const newUserRoleNorm = normalizeRole(role.name);

    // team lead cannot create admins
    if (isTeamLead && newUserRoleNorm === 'admin') {
      return res.status(403).json({ error: 'Team Leads cannot create admin users' });
    }

    // determine team for new user
    let finalTeamId = null;

    if (isAdmin) {
      // admin may specify a teamId or leave null
      if (teamId != null) {
        const team = await prisma.team.findUnique({ where: { id: teamId } });
        if (!team) {
          return res.status(400).json({ error: 'Invalid teamId' });
        }
        finalTeamId = team.id;
      }
    } else if (isTeamLead) {
      // Team lead can ONLY create members in their own team
      const requester = await prisma.user.findUnique({ where: { id: requesterId } });
      if (!requester || !requester.teamId) {
        return res.status(400).json({ error: 'Your team is not configured; contact an admin' });
      }
      finalTeamId = requester.teamId;
    }

    const hashed = await bcrypt.hash(String(password), 10);

    const created = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        password: hashed,
        roleId: role.id,
        teamId: finalTeamId,
      },
      include: { role: true, team: true },
    });

    const { password: _pw, ...safeUser } = created;
    res.status(201).json(safeUser);
  } catch (err) {
    console.error('POST /api/users error', err);
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'A user with this email already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/users/:id
 * Update a user.
 * Access:
 *   - admin: can edit anyone
 *   - team_lead: can edit users in their own team (but not themselves)
 *   - no one can edit themselves via this endpoint
 *   - team_lead CAN transfer their team members to other teams (via teamId)
 */
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const requesterId = req.user?.userId;
    const requesterRoleNorm = normalizeRole(req.user?.role);

    const isAdmin = requesterRoleNorm === 'admin';
    const isTeamLead =
      requesterRoleNorm === 'team_lead' ||
      requesterRoleNorm === 'team-lead';

    if (!isAdmin && !isTeamLead) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // no self-edit
    if (requesterId === id) {
      return res.status(403).json({ error: 'You cannot edit your own account' });
    }

    const requester = await prisma.user.findUnique({ where: { id: requesterId } });
    const target = await prisma.user.findUnique({
      where: { id },
      include: { role: true, team: true },
    });

    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetRoleNorm = normalizeRole(target.role?.name);

    // team_lead can only edit users in same team and cannot edit admins
    if (isTeamLead) {
      if (!requester?.teamId || requester.teamId !== target.teamId) {
        return res.status(403).json({ error: 'Insufficient permissions (different team)' });
      }
      if (targetRoleNorm === 'admin') {
        return res.status(403).json({ error: 'Team Leads cannot modify admin users' });
      }
    }

    const body = req.body || {};
    const data = {};

    // track if we must update leads' teamName
    // undefined => don't touch leads
    // string|null => new teamName for all leads
    let newTeamNameForLeads = undefined;

    // Basic fields
    if (body.name !== undefined) {
      if (!body.name || !body.name.trim()) {
        return res.status(400).json({ error: 'Name cannot be empty' });
      }
      data.name = body.name.trim();
    }

    if (body.email !== undefined) {
      if (!body.email || !body.email.trim()) {
        return res.status(400).json({ error: 'Email cannot be empty' });
      }
      data.email = body.email.trim();
    }

    // Password
    if (body.password !== undefined) {
      if (body.password && String(body.password).trim().length > 0) {
        if (String(body.password).length < 6) {
          return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        data.password = await bcrypt.hash(String(body.password), 10);
      }
    }

    // Role / team changes
    if (isAdmin || isTeamLead) {
      if (body.roleId !== undefined) {
        if (body.roleId === null || body.roleId === '') {
          data.roleId = null;
        } else {
          const newRole = await prisma.role.findUnique({ where: { id: body.roleId } });
          if (!newRole) {
            return res.status(400).json({ error: 'Invalid roleId' });
          }
          const newRoleNorm = normalizeRole(newRole.name);
          if (isTeamLead && newRoleNorm === 'admin') {
            return res.status(403).json({ error: 'Team Leads cannot assign the admin role' });
          }
          data.roleId = newRole.id;
        }
      }

      if (body.teamId !== undefined) {
        if (body.teamId === null || body.teamId === '') {
          // remove user from any team
          data.teamId = null;
          if (target.teamId !== null) {
            newTeamNameForLeads = null; // leads become "no team"
          }
        } else {
          const newTeam = await prisma.team.findUnique({ where: { id: body.teamId } });
          if (!newTeam) {
            return res.status(400).json({ error: 'Invalid teamId' });
          }
          data.teamId = newTeam.id;

          // if team changed, update leads' teamName to newTeam.name
          if (target.teamId !== newTeam.id) {
            newTeamNameForLeads = newTeam.name;
          }
        }
      }
    }

    // IP restriction / description fields — admin only
    if (isAdmin) {
      if (body.ipRestricted !== undefined) {
        data.ipRestricted = !!body.ipRestricted;
      }
      if (body.ipExempt !== undefined) {
        data.ipExempt = !!body.ipExempt;
      }
      if (Array.isArray(body.allowedIPs)) {
        data.allowedIPs = body.allowedIPs.map(String);
      }
      if (body.description !== undefined) {
        data.description = body.description || null;
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // 1) update the user
    const updated = await prisma.user.update({
      where: { id },
      data,
      include: { role: true, team: true },
    });

    // 2) if team changed, update ALL their leads' teamName
    if (newTeamNameForLeads !== undefined) {
      await prisma.lead.updateMany({
        where: { assignedToId: id },
        data: {
          teamName: newTeamNameForLeads,
        },
      });
    }

    const { password: _pw, ...safeUser } = updated;
    res.json(safeUser);
  } catch (err) {
    console.error('PATCH /api/users/:id error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});



/**
 * DELETE /api/users/:id
 * Delete a user.
 * Access:
 *   - admin: can delete anyone
 *   - team_lead: can delete users in their own team (but not themselves and not admins)
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const requesterId = req.user?.userId;
    const requesterRoleNorm = normalizeRole(req.user?.role);

    const isAdmin = requesterRoleNorm === 'admin';
    const isTeamLead =
      requesterRoleNorm === 'team_lead' ||
      requesterRoleNorm === 'team-lead';

    if (!isAdmin && !isTeamLead) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // cannot delete self
    if (requesterId === id) {
      return res.status(403).json({ error: 'You cannot delete your own account' });
    }

    const requester = await prisma.user.findUnique({ where: { id: requesterId } });
    const target = await prisma.user.findUnique({
      where: { id },
      include: { role: true, team: true },
    });

    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetRoleNorm = normalizeRole(target.role?.name);

    if (isTeamLead) {
      if (!requester?.teamId || requester.teamId !== target.teamId) {
        return res.status(403).json({ error: 'Insufficient permissions (different team)' });
      }
      if (targetRoleNorm === 'admin') {
        return res.status(403).json({ error: 'Team Leads cannot delete admin users' });
      }
    }

    await prisma.user.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/users/:id error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
