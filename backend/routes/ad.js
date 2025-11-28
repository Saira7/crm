// backend/routes/admin.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');

const prisma = new PrismaClient();
const router = express.Router();

function normalizeRole(role) {
  if (!role) return '';
  const r =
    typeof role === 'string'
      ? role
      : role.name || '';
  return String(r).toLowerCase().trim().replace(/\s+/g, '_');
}

// Simple admin check
function ensureAdmin(req, res) {
  const norm = normalizeRole(req.user?.role);
  if (norm !== 'admin') {
    res.status(403).json({ error: 'Admin only' });
    return false;
  }
  return true;
}

/**
 * GET /api/admin/overview
 * Query params:
 *  - from (ISO date, optional)
 *  - to (ISO date, optional)
 *  - teamId (Int, optional) -> filter only that team (by teamName on leads)
 */
router.get('/overview', requireAuth, async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { from, to, teamId } = req.query || {};

    let fromDate = null;
    let toDate = null;

    if (from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) fromDate = d;
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) {
        // make "to" inclusive by pushing to end of day
        d.setHours(23, 59, 59, 999);
        toDate = d;
      }
    }

    // Base where for createdAt
    const where = {};
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = fromDate;
      if (toDate) where.createdAt.lte = toDate;
    }

    // Optional team filter (by teamName on leads)
    let teamFilterName = null;
    if (teamId) {
      const idNum = Number(teamId);
      if (Number.isInteger(idNum)) {
        const team = await prisma.team.findUnique({ where: { id: idNum } });
        if (team) {
          teamFilterName = team.name;
          where.teamName = team.name;
        }
      }
    }

    const now = new Date();

    // --- Aggregations ---
    const [
      totalLeads,
      totalCallbacks,
      totalSales,
      totalTransfers,
      statusDist,
      leadsByTeamAll,
      leadsByTeamSales,
      leadsByAgentAll,
      leadsByAgentSales,
      overdueCount,
      teams,
    ] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { ...where, status: 'callback' } }),
      prisma.lead.count({ where: { ...where, status: 'sale' } }),
      prisma.lead.count({ where: { ...where, status: 'transfer' } }),

      prisma.lead.groupBy({
        by: ['status'],
        _count: { _all: true },
        where,
      }),

      prisma.lead.groupBy({
        by: ['teamName'],
        _count: { _all: true },
        where,
      }),
      prisma.lead.groupBy({
        by: ['teamName'],
        _count: { _all: true },
        where: { ...where, status: 'sale' },
      }),

      prisma.lead.groupBy({
        by: ['assignedToId'],
        _count: { _all: true },
        where,
      }),
      prisma.lead.groupBy({
        by: ['assignedToId'],
        _count: { _all: true },
        where: { ...where, status: 'sale' },
      }),

      prisma.lead.count({
        where: {
          ...where,
          dueDate: { lt: now },
        },
      }),

      prisma.team.findMany(),
    ]);

    // map status distribution
    const statusDistribution = statusDist.map((row) => ({
      status: row.status || 'unknown',
      count: row._count._all,
    }));

    // merge team totals + team sales
    const salesByTeamMap = new Map();
    leadsByTeamSales.forEach((row) => {
      salesByTeamMap.set(row.teamName || 'Unassigned', row._count._all);
    });

    const byTeam = leadsByTeamAll.map((row) => {
      const name = row.teamName || 'Unassigned';
      return {
        teamName: name,
        totalLeads: row._count._all,
        sales: salesByTeamMap.get(name) || 0,
      };
    });

    // merge agent totals + agent sales
    const salesByAgentMap = new Map();
    leadsByAgentSales.forEach((row) => {
      if (row.assignedToId != null) {
        salesByAgentMap.set(row.assignedToId, row._count._all);
      }
    });

    const agentIds = leadsByAgentAll
      .map((row) => row.assignedToId)
      .filter((id) => id != null);

    const users = agentIds.length
      ? await prisma.user.findMany({
          where: { id: { in: agentIds } },
          include: { team: true },
        })
      : [];

    const userMap = new Map();
    users.forEach((u) => userMap.set(u.id, u));

    const byAgent = leadsByAgentAll
      .filter((row) => row.assignedToId != null)
      .map((row) => {
        const u = userMap.get(row.assignedToId);
        return {
          userId: row.assignedToId,
          name: u?.name || `User #${row.assignedToId}`,
          email: u?.email || null,
          teamName: u?.team?.name || null,
          totalLeads: row._count._all,
          sales: salesByAgentMap.get(row.assignedToId) || 0,
        };
      });

    const conversionRate =
      totalLeads > 0 ? Number(((totalSales / totalLeads) * 100).toFixed(1)) : 0;

    res.json({
      range: {
        from: fromDate ? fromDate.toISOString() : null,
        to: toDate ? toDate.toISOString() : null,
        teamId: teamId ? Number(teamId) : null,
        teamName: teamFilterName,
      },
      totals: {
        totalLeads,
        totalCallbacks,
        totalSales,
        totalTransfers,
        conversionRate,
        overdueCount,
      },
      statusDistribution,
      byTeam,
      byAgent,
      teams: teams.map((t) => ({ id: t.id, name: t.name })),
    });
  } catch (err) {
    console.error('GET /api/admin/overview error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
