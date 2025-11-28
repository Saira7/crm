// routes/leads.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();
const { requireAuth } = require('../middleware/auth'); 

// Utility: parse a date-ish string. Accepts ISO or datetime-local ("YYYY-MM-DDTHH:mm" or "YYYY-MM-DDTHH:mm:ss" or ISO)
function parseDateMaybe(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val !== 'string') return null;

  // If it's already an ISO string with timezone, parse directly
  if (val.includes('Z') || val.includes('+')) {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  // Handle datetime-local format (YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss)
  const withoutTZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(val);
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(val);
  
  try {
    if (withoutTZ) {
      // Append seconds and treat as local time
      return new Date(val + ':00');
    }
    if (withSeconds) {
      return new Date(val);
    }
    // Fallback to Date parsing
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  } catch (err) {
    return null;
  }
}

// Utility: normalize tags input into string[]
function normalizeTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map(String);
  if (typeof tags === 'string') {
    return tags.split(',').map(t => t.trim()).filter(Boolean);
  }
  return [];
}

// Helper to load current user fully (role, team)
async function loadRequestingUser(userId) {
  if (!userId) return null;
  return await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true, team: true }
  });
}

// GET /api/leads  (list)
router.get('/', requireAuth, async (req, res) => {
  try {
    const reqUser = await loadRequestingUser(req.user?.userId);
    const roleName = reqUser?.role?.name || (req.user?.role || 'user');

    let where = {};

    if (roleName === 'admin') {
      // admin sees all
      where = {};
    } else if (roleName === 'team_lead' || roleName === 'Team Lead') {
      // team lead sees own team's leads
      const teamName = reqUser?.team?.name || null;
      where = teamName ? { teamName } : { assignedToId: reqUser.id };
    } else {
      // regular user:
      // show leads currently assigned to them OR leads they previously owned
      where = {
        OR: [
          { assignedToId: reqUser.id },
          { previousAssignedToIds: { has: reqUser.id } }
        ]
      };
    }

    const leads = await prisma.lead.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true } }
      },
      orderBy: { id: 'desc' }
    });

    const leadsWithNames = leads.map(l => ({
      ...l,
      assignedToName: l.assignedTo?.name || null
    }));

    res.json(leadsWithNames);
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// POST /api/leads  (create)
router.post('/', requireAuth, async (req, res) => {
  try {
    console.log('POST /leads body:', req.body);

    const requester = await loadRequestingUser(req.user?.userId);
    if (!requester) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Validate required fields (per your schema)
    const required = ['companyName', 'companyAddress', 'businessNature', 'mobile'];
    for (const f of required) {
      if (!req.body[f]) {
        return res.status(400).json({ error: `Missing required field: ${f}` });
      }
    }

    // Normalize tags
    const tags = normalizeTags(req.body.tags);

    // Enhanced Assignment rules based on role
    let assignedToId = req.body.assignedToId ? parseInt(req.body.assignedToId, 10) : null;
    const requesterRole = requester?.role?.name || (req.user?.role || 'user');
    const requesterTeam = requester?.team?.name || null;

    if (assignedToId) {
      // Validate target user exists
      const targetUser = await prisma.user.findUnique({ 
        where: { id: assignedToId }, 
        include: { team: true, role: true } 
      });
      
      if (!targetUser) {
        // Invalid user ID - assign to requester
        assignedToId = requester.id;
      } else {
        // Check assignment permissions based on role
        if (requesterRole === 'admin') {
          // Admin can assign to anyone - no restrictions
        } else if (requesterRole === 'team_lead'||requesterRole === 'Team Lead') {
          // Team lead can assign to themselves or team members
          const targetTeam = targetUser?.team?.name || null;
          if (targetTeam !== requesterTeam) {
            // Not in same team - assign to requester (team lead)
            assignedToId = requester.id;
          }
        } else {
          // Regular user can only assign to themselves or their team lead
          const targetTeam = targetUser?.team?.name || null;
          const isTargetTeamLead = targetUser?.role?.name === 'team_lead' || targetUser?.role?.name === 'Team Lead';
          
          if (assignedToId !== requester.id && (!isTargetTeamLead || targetTeam !== requesterTeam)) {
            // Not allowed - assign to requester
            assignedToId = requester.id;
          }
        }
      }
    } else {
      // No assignment specified - default to requester
      assignedToId = requester.id;
    }

    // decide teamName for the lead – from assigned user if possible
    let leadTeamName = null;

    if (assignedToId) {
      const assignedUser = await prisma.user.findUnique({
        where: { id: assignedToId },
        include: { team: true }
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

    // Build data object for Prisma
    const data = {
      // Sale info: saleDate and agentName auto-fill
      saleDate: parseDateMaybe(req.body.saleDate) || new Date(),
      agentName: req.body.agentName || requester?.name || null,
      closerName: req.body.closerName || null,
      pseudo: req.body.pseudo || null,

      // Company details
      companyName: req.body.companyName,
      companyType: req.body.companyType || null,
      registrationNumber: req.body.registrationNumber || null,
      tradingName: req.body.tradingName || null,
      numberOfDirectors: req.body.numberOfDirectors ? parseInt(req.body.numberOfDirectors, 10) : null,
      companyAddress: req.body.companyAddress,
      businessNature: req.body.businessNature,
      landline: req.body.landline || null,
      mobile: req.body.mobile,
      email: req.body.email||null,
      website: req.body.website || null,

      // Owners
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

      // Payment processing
      offeredCompany: req.body.offeredCompany || null,
      offeredTerms: req.body.offeredTerms || null,
      existingCompany: req.body.existingCompany || null,
      remainingTerms: req.body.remainingTerms || null,
      alreadyPayingCharges: req.body.alreadyPayingCharges || null,
      details: req.body.details || null,
      totalTurnover: req.body.totalTurnover ? parseFloat(req.body.totalTurnover) : null,
      cardTurnover: req.body.cardTurnover ? parseFloat(req.body.cardTurnover) : null,
      avgTransaction: req.body.avgTransaction ? parseFloat(req.body.avgTransaction) : null,
      minTransaction: req.body.minTransaction ? parseFloat(req.body.minTransaction) : null,
      maxTransaction: req.body.maxTransaction ? parseFloat(req.body.maxTransaction) : null,
      monthlyLineRent: req.body.monthlyLineRent ? parseFloat(req.body.monthlyLineRent) : null,
      debitPercentage: req.body.debitPercentage ? parseFloat(req.body.debitPercentage) : null,
      creditPercentage: req.body.creditPercentage ? parseFloat(req.body.creditPercentage) : null,
      authorizationFee: req.body.authorizationFee ? parseFloat(req.body.authorizationFee) : null,
      otherCards: req.body.otherCards || null,

      // Banking
      accountTitle: req.body.accountTitle || null,
      accountNumber: req.body.accountNumber || null,
      sortCode: req.body.sortCode || null,
      iban: req.body.iban || null,
      bankName: req.body.bankName || null,

      // Lead management
      status: req.body.status || 'lead',
      assignedTo: assignedToId ? { connect: { id: assignedToId } } : undefined,
      teamName: leadTeamName,

      // Comments and timestamps
      leadComment: req.body.leadComment || null,
      leadCommentDate: req.body.leadComment ? new Date() : null,
      callbackComment: req.body.callbackComment || null,
      callbackCommentDate: req.body.callbackComment ? new Date() : null,
      saleComment: req.body.saleComment || null,
      saleCommentDate: req.body.saleComment ? new Date() : null,

      // Due date
      dueDate: req.body.dueDate ? parseDateMaybe(req.body.dueDate) : null,
      dueDateUpdatedAt: req.body.dueDate ? new Date() : null,

      // tags
      tags: tags
    };

    // create lead
    const lead = await prisma.lead.create({
      data,
      include: {
        assignedTo: { select: { id: true, name: true } }
      }
    });

    const result = { ...lead, assignedToName: lead.assignedTo?.name || null };
    res.json(result);
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: error.message || 'Failed to create lead' });
  }
});

// PUT /api/leads/:id  (partial update)
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

    const body = req.body || {};
    const patch = {};

    const copyIf = (k, transform = x => x) => {
      if (body[k] !== undefined) patch[k] = transform(body[k]);
    };

    // simple strings
    [
      'companyName','companyType','registrationNumber','tradingName','companyAddress','businessNature',
      'landline','mobile','email','website','tenure','previousAddress','offeredCompany','offeredTerms',
      'existingCompany','remainingTerms','alreadyPayingCharges','details','otherCards','accountTitle',
      'accountNumber','sortCode','iban','bankName','pseudo','agentName','closerName'
    ].forEach(k => copyIf(k, v => v === '' ? null : v));

    // numeric conversions
    copyIf('numberOfDirectors', v => v ? parseInt(v,10) : null);
    [
      'totalTurnover','cardTurnover','avgTransaction','minTransaction','maxTransaction',
      'monthlyLineRent','debitPercentage','creditPercentage','authorizationFee'
    ].forEach(k => copyIf(k, v => v != null ? parseFloat(v) : null));

    // owner fields
    copyIf('directorOwnerName1'); copyIf('position1'); copyIf('nationality1'); copyIf('homeAddress1');
    copyIf('directorOwnerName2'); copyIf('position2'); copyIf('nationality2'); copyIf('homeAddress2');

    // dates
    if (body.dob1 !== undefined) patch.dob1 = body.dob1 ? parseDateMaybe(body.dob1) : null;
    if (body.dob2 !== undefined) patch.dob2 = body.dob2 ? parseDateMaybe(body.dob2) : null;
    if (body.saleDate !== undefined) patch.saleDate = body.saleDate ? parseDateMaybe(body.saleDate) : null;
    if (body.dueDate !== undefined) {
      patch.dueDate = body.dueDate ? parseDateMaybe(body.dueDate) : null;
      patch.dueDateUpdatedAt = body.dueDate ? new Date() : null;
    }

    // tags
    if (body.tags !== undefined) patch.tags = normalizeTags(body.tags);

    // comments
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

    // status
    if (body.status !== undefined) patch.status = body.status;

    // Enhanced Assignment logic for updates + previousAssignedToIds history
    if (body.assignedToId !== undefined) {
      let assignedToId = body.assignedToId ? parseInt(body.assignedToId, 10) : null;
      
      if (assignedToId) {
        const targetUser = await prisma.user.findUnique({ 
          where: { id: assignedToId }, 
          include: { team: true, role: true } 
        });
        
        if (!targetUser) {
          patch.assignedTo = { disconnect: true };
        } else {
          if (requesterRole === 'admin') {
            patch.assignedTo = { connect: { id: assignedToId } };
          } else if (requesterRole === 'team_lead'||requesterRole === 'Team Lead') {
            const targetTeam = targetUser?.team?.name || null;
            if (targetTeam === requesterTeam) {
              patch.assignedTo = { connect: { id: assignedToId } };
            } else {
              patch.assignedTo = { connect: { id: requester.id } };
              assignedToId = requester.id;
            }
          } else {
            const targetTeam = targetUser?.team?.name || null;
            const isTargetTeamLead = targetUser?.role?.name === 'team_lead'|| targetUser?.role?.name === 'Team Lead';
            
            if (assignedToId === requester.id || (isTargetTeamLead && targetTeam === requesterTeam)) {
              patch.assignedTo = { connect: { id: assignedToId } };
            } else {
              patch.assignedTo = { connect: { id: requester.id } };
              assignedToId = requester.id;
            }
          }

          // 🔹 history: if assignee changed, store old assignee in previousAssignedToIds
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
        // assignedToId is null/empty - assign to requester
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
      include: { assignedTo: { select: { id: true, name: true } } }
    });

    res.json({ ...updated, assignedToName: updated.assignedTo?.name || null });
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
// GET /api/leads/analytics  (admin-only)
router.get('/analytics', requireAuth, async (req, res) => {
  try {
    const reqUser = await loadRequestingUser(req.user?.userId);
    const roleName = reqUser?.role?.name || (req.user?.role || 'user');
    const normRole = roleName.toString().toLowerCase();

    // Only admin can see global analytics
    if (normRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const now = new Date();

    // Helpers for time ranges (in server local time)
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(startOfDay);
    const day = startOfWeek.getDay(); // 0 = Sun
    const diffToMonday = (day + 6) % 7; // makes Monday the start
    startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);

    const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);

    // Main aggregates
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

    // By status
    const byStatus = {};
    statusGroups.forEach((row) => {
      const key = row.status || 'unknown';
      byStatus[key] = row._count._all;
    });

    // By team
    const byTeam = teamGroups
      .map((row) => ({
        teamName: row.teamName || 'Unassigned',
        count: row._count._all,
      }))
      .sort((a, b) => b.count - a.count);

    // By user (top agents)
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
      .slice(0, 10); // top 10

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
