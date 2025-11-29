// backend/routes/leads.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// Utility: parse date-ish strings
function parseDateMaybe(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val !== 'string') return null;

  if (val.includes('Z') || val.includes('+')) {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  const withoutTZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(val);
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(val);

  try {
    if (withoutTZ) return new Date(val + ':00');
    if (withSeconds) return new Date(val);
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

// tags -> string[]
function normalizeTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map(String);
  if (typeof tags === 'string') {
    return tags.split(',').map((t) => t.trim()).filter(Boolean);
  }
  return [];
}

// load user with role, team, leadTeams
async function loadRequestingUser(userId) {
  if (!userId) return null;
  return await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: true,
      team: true,
      leadTeams: {
        include: { team: true },
      },
    },
  });
}

// GET /api/leads
router.get('/', requireAuth, async (req, res) => {
  try {
    const reqUser = await loadRequestingUser(req.user?.userId);
    const roleName = reqUser?.role?.name || (req.user?.role || 'user');

    const leadTeams = reqUser?.leadTeams || [];
    const leadTeamNames = leadTeams
      .map((lt) => lt.team?.name)
      .filter(Boolean);

    let where = {};

    if (roleName === 'admin') {
      where = {};
    } else if (roleName === 'team_lead' || roleName === 'Team Lead') {
      // TL sees leads for ALL teams they lead, fallback to their own team
      let allowedTeamNames = leadTeamNames;
      const homeTeamName = reqUser?.team?.name || null;

      if (!allowedTeamNames.length && homeTeamName) {
        allowedTeamNames = [homeTeamName];
      }

      if (allowedTeamNames.length > 0) {
        where = {
          teamName: { in: allowedTeamNames },
        };
      } else {
        where = { assignedToId: reqUser.id };
      }
    } else {
      where = {
        OR: [
          { assignedToId: reqUser.id },
          { previousAssignedToIds: { has: reqUser.id } },
        ],
      };
    }

    const leads = await prisma.lead.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: { id: 'desc' },
    });

    const leadsWithNames = leads.map((l) => ({
      ...l,
      assignedToName: l.assignedTo?.name || null,
    }));

    res.json(leadsWithNames);
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// POST /api/leads
router.post('/', requireAuth, async (req, res) => {
  try {
    console.log('POST /leads body:', req.body);

    const requester = await loadRequestingUser(req.user?.userId);
    if (!requester) {
      return res.status(401).json({ error: 'User not found' });
    }

    const required = ['companyName', 'companyAddress', 'businessNature', 'mobile'];
    for (const f of required) {
      if (!req.body[f]) {
        return res.status(400).json({ error: `Missing required field: ${f}` });
      }
    }

    const tags = normalizeTags(req.body.tags);

    let assignedToId = req.body.assignedToId
      ? parseInt(req.body.assignedToId, 10)
      : null;

    const requesterRole = requester?.role?.name || (req.user?.role || 'user');
    const requesterTeam = requester?.team?.name || null;
    const requesterLeadTeams = requester?.leadTeams || [];
    const leadTeamNames = requesterLeadTeams
      .map((lt) => lt.team?.name)
      .filter(Boolean);
    const requesterTeamNames =
      leadTeamNames.length > 0
        ? leadTeamNames
        : requesterTeam
        ? [requesterTeam]
        : [];

    if (assignedToId) {
      const targetUser = await prisma.user.findUnique({
        where: { id: assignedToId },
        include: { team: true, role: true },
      });

      if (!targetUser) {
        assignedToId = requester.id;
      } else {
        if (requesterRole === 'admin') {
          // ok
        } else if (requesterRole === 'team_lead' || requesterRole === 'Team Lead') {
          const targetTeam = targetUser?.team?.name || null;
          const allowed =
            targetTeam &&
            requesterTeamNames.length > 0 &&
            requesterTeamNames.includes(targetTeam);

          if (!allowed) {
            assignedToId = requester.id;
          }
        } else {
          const targetTeam = targetUser?.team?.name || null;
          const isTargetTeamLead =
            targetUser?.role?.name === 'team_lead' ||
            targetUser?.role?.name === 'Team Lead';

          const allowed =
            assignedToId === requester.id ||
            (isTargetTeamLead && targetTeam === requesterTeam);

          if (!allowed) {
            assignedToId = requester.id;
          }
        }
      }
    } else {
      assignedToId = requester.id;
    }

    // teamName for lead
    let leadTeamName = null;
    if (assignedToId) {
      const assignedUser = await prisma.user.findUnique({
        where: { id: assignedToId },
        include: { team: true },
      });
      if (assignedUser?.teamId) {
        leadTeamName = assignedUser.team?.name || null;
      }
    }
    if (!leadTeamName && requester?.teamId) {
      leadTeamName = requester.team?.name || requesterTeam || null;
    }
    if (!leadTeamName && req.body.teamName) {
      leadTeamName = req.body.teamName;
    }

    const data = {
      saleDate: parseDateMaybe(req.body.saleDate) || new Date(),
      agentName: req.body.agentName || requester?.name || null,
      closerName: req.body.closerName || null,
      pseudo: req.body.pseudo || null,

      companyName: req.body.companyName,
      companyType: req.body.companyType || null,
      registrationNumber: req.body.registrationNumber || null,
      tradingName: req.body.tradingName || null,
      numberOfDirectors: req.body.numberOfDirectors
        ? parseInt(req.body.numberOfDirectors, 10)
        : null,
      companyAddress: req.body.companyAddress,
      businessNature: req.body.businessNature,
      landline: req.body.landline || null,
      mobile: req.body.mobile,
      email: req.body.email || null,
      website: req.body.website || null,

      directorOwnerName1: req.body.directorOwnerName1 || null,
      position1: req.body.position1 || null,
      dob1: parseDateMaybe(req.body.dob1) || null,
      nationality1: req.body.nationality1 || null,
      homeAddress1: req.body.homeAddress1 || null,

      directorOwnerName2: req.body.directorOwnerName2 || null,
      position2: req.body.position2 || null,
      dob2: parseDateMaybe(req.body.dob2) || null,
      nationality2: req.body.nationality2 || null,
      homeAddress2: req.body.homeAddress2 || null,

      tenure: req.body.tenure || null,
      previousAddress: req.body.previousAddress || null,

      offeredCompany: req.body.offeredCompany || null,
      offeredTerms: req.body.offeredTerms || null,
      existingCompany: req.body.existingCompany || null,
      remainingTerms: req.body.remainingTerms || null,
      alreadyPayingCharges: req.body.alreadyPayingCharges || null,
      details: req.body.details || null,
      totalTurnover: req.body.totalTurnover
        ? parseFloat(req.body.totalTurnover)
        : null,
      cardTurnover: req.body.cardTurnover
        ? parseFloat(req.body.cardTurnover)
        : null,
      avgTransaction: req.body.avgTransaction
        ? parseFloat(req.body.avgTransaction)
        : null,
      minTransaction: req.body.minTransaction
        ? parseFloat(req.body.minTransaction)
        : null,
      maxTransaction: req.body.maxTransaction
        ? parseFloat(req.body.maxTransaction)
        : null,
      monthlyLineRent: req.body.monthlyLineRent
        ? parseFloat(req.body.monthlyLineRent)
        : null,
      debitPercentage: req.body.debitPercentage
        ? parseFloat(req.body.debitPercentage)
        : null,
      creditPercentage: req.body.creditPercentage
        ? parseFloat(req.body.creditPercentage)
        : null,
      authorizationFee: req.body.authorizationFee
        ? parseFloat(req.body.authorizationFee)
        : null,
      otherCards: req.body.otherCards || null,

      accountTitle: req.body.accountTitle || null,
      accountNumber: req.body.accountNumber || null,
      sortCode: req.body.sortCode || null,
      iban: req.body.iban || null,
      bankName: req.body.bankName || null,

      status: req.body.status || 'lead',
      assignedTo: assignedToId ? { connect: { id: assignedToId } } : undefined,
      teamName: leadTeamName,

      leadComment: req.body.leadComment || null,
      leadCommentDate: req.body.leadComment ? new Date() : null,
      callbackComment: req.body.callbackComment || null,
      callbackCommentDate: req.body.callbackComment ? new Date() : null,
      saleComment: req.body.saleComment || null,
      saleCommentDate: req.body.saleComment ? new Date() : null,

      dueDate: req.body.dueDate ? parseDateMaybe(req.body.dueDate) : null,
      dueDateUpdatedAt: req.body.dueDate ? new Date() : null,

      tags,
    };

    const lead = await prisma.lead.create({
      data,
      include: {
        assignedTo: { select: { id: true, name: true } },
      },
    });

    const result = { ...lead, assignedToName: lead.assignedTo?.name || null };
    res.json(result);
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: error.message || 'Failed to create lead' });
  }
});

// PUT /api/leads/:id
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid lead id' });

    const requester = await loadRequestingUser(req.user?.userId);
    if (!requester) {
      return res.status(401).json({ error: 'User not found' });
    }

    const existingLead = await prisma.lead.findUnique({ where: { id } });
    if (!existingLead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const requesterRole = requester?.role?.name || (req.user?.role || 'user');
    const requesterTeam = requester?.team?.name || null;
    const requesterLeadTeams = requester?.leadTeams || [];
    const leadTeamNames = requesterLeadTeams
      .map((lt) => lt.team?.name)
      .filter(Boolean);
    const requesterTeamNames =
      leadTeamNames.length > 0
        ? leadTeamNames
        : requesterTeam
        ? [requesterTeam]
        : [];

    const body = req.body || {};
    const patch = {};

    const copyIf = (k, transform = (x) => x) => {
      if (body[k] !== undefined) patch[k] = transform(body[k]);
    };

    [
      'companyName',
      'companyType',
      'registrationNumber',
      'tradingName',
      'companyAddress',
      'businessNature',
      'landline',
      'mobile',
      'email',
      'website',
      'tenure',
      'previousAddress',
      'offeredCompany',
      'offeredTerms',
      'existingCompany',
      'remainingTerms',
      'alreadyPayingCharges',
      'details',
      'otherCards',
      'accountTitle',
      'accountNumber',
      'sortCode',
      'iban',
      'bankName',
      'pseudo',
      'agentName',
      'closerName',
    ].forEach((k) => copyIf(k, (v) => (v === '' ? null : v)));

    copyIf('numberOfDirectors', (v) => (v ? parseInt(v, 10) : null));
    [
      'totalTurnover',
      'cardTurnover',
      'avgTransaction',
      'minTransaction',
      'maxTransaction',
      'monthlyLineRent',
      'debitPercentage',
      'creditPercentage',
      'authorizationFee',
    ].forEach((k) =>
      copyIf(k, (v) => (v != null && v !== '' ? parseFloat(v) : null))
    );

    copyIf('directorOwnerName1');
    copyIf('position1');
    copyIf('nationality1');
    copyIf('homeAddress1');
    copyIf('directorOwnerName2');
    copyIf('position2');
    copyIf('nationality2');
    copyIf('homeAddress2');

    if (body.dob1 !== undefined)
      patch.dob1 = body.dob1 ? parseDateMaybe(body.dob1) : null;
    if (body.dob2 !== undefined)
      patch.dob2 = body.dob2 ? parseDateMaybe(body.dob2) : null;
    if (body.saleDate !== undefined)
      patch.saleDate = body.saleDate ? parseDateMaybe(body.saleDate) : null;
    if (body.dueDate !== undefined) {
      patch.dueDate = body.dueDate ? parseDateMaybe(body.dueDate) : null;
      patch.dueDateUpdatedAt = body.dueDate ? new Date() : null;
    }

    if (body.tags !== undefined) patch.tags = normalizeTags(body.tags);

    if (body.leadComment !== undefined) {
      patch.leadComment = body.leadComment || null;
      patch.leadCommentDate = body.leadComment ? new Date() : null;
    }
    if (body.callbackComment !== undefined) {
      patch.callbackComment = body.callbackComment || null;
      patch.callbackCommentDate = body.callbackComment ? new Date() : null;
    }
    if (body.saleComment !== undefined) {
      patch.saleComment = body.saleComment || null;
      patch.saleCommentDate = body.saleComment ? new Date() : null;
    }

    if (body.status !== undefined) patch.status = body.status;

    if (body.assignedToId !== undefined) {
      let assignedToId = body.assignedToId
        ? parseInt(body.assignedToId, 10)
        : null;

      if (assignedToId) {
        const targetUser = await prisma.user.findUnique({
          where: { id: assignedToId },
          include: { team: true, role: true },
        });

        if (!targetUser) {
          patch.assignedTo = { disconnect: true };
        } else {
          if (requesterRole === 'admin') {
            patch.assignedTo = { connect: { id: assignedToId } };
          } else if (
            requesterRole === 'team_lead' ||
            requesterRole === 'Team Lead'
          ) {
            const targetTeam = targetUser?.team?.name || null;
            const allowed =
              targetTeam &&
              requesterTeamNames.length > 0 &&
              requesterTeamNames.includes(targetTeam);
            if (allowed) {
              patch.assignedTo = { connect: { id: assignedToId } };
            } else {
              patch.assignedTo = { connect: { id: requester.id } };
              assignedToId = requester.id;
            }
          } else {
            const targetTeam = targetUser?.team?.name || null;
            const isTargetTeamLead =
              targetUser?.role?.name === 'team_lead' ||
              targetUser?.role?.name === 'Team Lead';

            const allowed =
              assignedToId === requester.id ||
              (isTargetTeamLead && targetTeam === requesterTeam);

            if (allowed) {
              patch.assignedTo = { connect: { id: assignedToId } };
            } else {
              patch.assignedTo = { connect: { id: requester.id } };
              assignedToId = requester.id;
            }
          }

          const oldAssigneeId = existingLead.assignedToId;
          const prevList = existingLead.previousAssignedToIds || [];

          if (
            oldAssigneeId &&
            oldAssigneeId !== assignedToId &&
            !prevList.includes(oldAssigneeId)
          ) {
            patch.previousAssignedToIds = {
              set: [...prevList, oldAssigneeId],
            };
          }
        }
      } else {
        patch.assignedTo = { connect: { id: requester.id } };

        const oldAssigneeId = existingLead.assignedToId;
        const prevList = existingLead.previousAssignedToIds || [];

        if (
          oldAssigneeId &&
          oldAssigneeId !== requester.id &&
          !prevList.includes(oldAssigneeId)
        ) {
          patch.previousAssignedToIds = {
            set: [...prevList, oldAssigneeId],
          };
        }
      }
    }

    if (body.teamName !== undefined) patch.teamName = body.teamName || null;

    const updated = await prisma.lead.update({
      where: { id },
      data: patch,
      include: { assignedTo: { select: { id: true, name: true } } },
    });

    res.json({
      ...updated,
      assignedToName: updated.assignedTo?.name || null,
    });
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ error: error.message || 'Failed to update lead' });
  }
});

// DELETE /api/leads/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    await prisma.lead.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting lead:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

// GET /api/leads/analytics (admin only)
router.get('/analytics', requireAuth, async (req, res) => {
  try {
    const reqUser = await loadRequestingUser(req.user?.userId);
    const roleName = reqUser?.role?.name || (req.user?.role || 'user');
    const normRole = roleName.toString().toLowerCase();

    if (normRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const now = new Date();

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(startOfDay);
    const day = startOfWeek.getDay();
    const diffToMonday = (day + 6) % 7;
    startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);

    const startOfMonth = new Date(
      startOfDay.getFullYear(),
      startOfDay.getMonth(),
      1
    );

    const [
      totalLeads,
      statusGroups,
      teamGroups,
      userGroups,
      todayTotal,
      weekTotal,
      monthTotal,
      todaySales,
      weekSales,
      monthSales,
    ] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.lead.groupBy({
        by: ['teamName'],
        _count: { _all: true },
      }),
      prisma.lead.groupBy({
        by: ['assignedToId'],
        _count: { _all: true },
      }),

      prisma.lead.count({
        where: { createdAt: { gte: startOfDay } },
      }),
      prisma.lead.count({
        where: { createdAt: { gte: startOfWeek } },
      }),
      prisma.lead.count({
        where: { createdAt: { gte: startOfMonth } },
      }),

      prisma.lead.count({
        where: { createdAt: { gte: startOfDay }, status: 'sale' },
      }),
      prisma.lead.count({
        where: { createdAt: { gte: startOfWeek }, status: 'sale' },
      }),
      prisma.lead.count({
        where: { createdAt: { gte: startOfMonth }, status: 'sale' },
      }),
    ]);

    const byStatus = {};
    statusGroups.forEach((row) => {
      const key = row.status || 'unknown';
      byStatus[key] = row._count._all;
    });

    const byTeam = teamGroups
      .map((row) => ({
        teamName: row.teamName || 'Unassigned',
        count: row._count._all,
      }))
      .sort((a, b) => b.count - a.count);

    const userIds = userGroups
      .map((r) => r.assignedToId)
      .filter((id) => id != null);

    let users = [];
    if (userIds.length > 0) {
      users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          name: true,
          team: { select: { name: true } },
        },
      });
    }

    const userMap = new Map();
    users.forEach((u) => userMap.set(u.id, u));

    const byUser = userGroups
      .filter((row) => row.assignedToId != null)
      .map((row) => {
        const u = userMap.get(row.assignedToId) || {};
        return {
          userId: row.assignedToId,
          userName: u.name || `User #${row.assignedToId}`,
          teamName: u.team?.name || 'No team',
          count: row._count._all,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const totals = {
      totalLeads,
      totalSales: byStatus.sale || 0,
      totalCallbacks: byStatus.callback || 0,
      totalTransfers: byStatus.transfer || 0,
    };

    const timeBuckets = {
      today: {
        total: todayTotal,
        sales: todaySales,
      },
      thisWeek: {
        total: weekTotal,
        sales: weekSales,
      },
      thisMonth: {
        total: monthTotal,
        sales: monthSales,
      },
    };

    res.json({
      totals,
      byStatus,
      byTeam,
      byUser,
      timeBuckets,
      generatedAt: now.toISOString(),
    });
  } catch (err) {
    console.error('GET /api/leads/analytics error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
