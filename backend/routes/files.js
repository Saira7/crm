// backend/routes/files.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');

const prisma = new PrismaClient();
const router = express.Router();

// ensure uploads folder exists
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || '');
    cb(null, unique + ext);
  },
});

const upload = multer({ storage });

/**
 * Helper: role + team lead context
 */
async function getRoleContext(req) {
  const userId = req.user?.userId || null;

  let rawRole = null;
  if (req.user?.role) {
    if (typeof req.user.role === 'string') rawRole = req.user.role;
    else if (req.user.role.name) rawRole = req.user.role.name;
  }
  const role = rawRole ? String(rawRole).toLowerCase() : 'user';
  const isAdmin = role === 'admin';
  const isTeamLead = role === 'team_lead' || role === 'team lead';

  let teamId = null;
  let leadTeamIds = [];

  if (userId) {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        teamId: true,
        leadTeams: {
          select: { teamId: true },
        },
      },
    });

    teamId = dbUser?.teamId ?? null;
    leadTeamIds = (dbUser?.leadTeams || []).map((lt) => lt.teamId);

    // Optional: if TL has no explicit leadTeams, fallback to their own team
    if (isTeamLead && leadTeamIds.length === 0 && teamId) {
      leadTeamIds = [teamId];
    }
  }

  return { userId, role, isAdmin, isTeamLead, teamId, leadTeamIds };
}

// GET /api/files
router.get('/', requireAuth, async (req, res) => {
  try {
    const { userId, isAdmin, isTeamLead, leadTeamIds } =
      await getRoleContext(req);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let where = {};

    if (isAdmin) {
      where = {};
    } else if (isTeamLead && leadTeamIds.length > 0) {
      // files where owner is in any of the TL's teams
      where = {
        user: {
          teamId: { in: leadTeamIds },
        },
      };
    } else {
      where = { userId };
    }

    const files = await prisma.fileAttachment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            team: { select: { id: true, name: true } },
          },
        },
      },
    });

    res.json(files);
  } catch (err) {
    console.error('GET /api/files error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/files
router.post(
  '/',
  requireAuth,
  upload.single('file'),
  async (req, res) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { description } = req.body || {};
      const file = req.file;

      const created = await prisma.fileAttachment.create({
        data: {
          userId,
          originalName: file.originalname,
          storedName: file.filename,
          mimeType: file.mimetype,
          size: file.size,
          description: description || null,
        },
      });

      res.status(201).json(created);
    } catch (err) {
      console.error('POST /api/files error', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// helper: permission check
async function canAccessFile(fileRecord, ctx) {
  const { userId, isAdmin, isTeamLead, leadTeamIds } = ctx;
  if (!userId) return false;
  if (isAdmin) return true;
  if (!fileRecord) return false;

  const sameOwner = fileRecord.userId === userId;
  const ownerTeamId = fileRecord.user?.teamId ?? null;
  const sameLeadTeam =
    isTeamLead && ownerTeamId && leadTeamIds.includes(ownerTeamId);

  return sameOwner || sameLeadTeam;
}

// GET /api/files/:id/download
router.get('/:id/download', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid file id' });
    }

    const ctx = await getRoleContext(req);

    const fileRecord = await prisma.fileAttachment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, teamId: true } },
      },
    });

    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found' });
    }

    const allowed = await canAccessFile(fileRecord, ctx);
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const filePath = path.join(UPLOAD_DIR, fileRecord.storedName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Physical file missing' });
    }

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(fileRecord.originalName)}"`
    );
    res.setHeader(
      'Content-Type',
      fileRecord.mimeType || 'application/octet-stream'
    );

    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('GET /api/files/:id/download error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/files/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid file id' });
    }

    const ctx = await getRoleContext(req);

    const fileRecord = await prisma.fileAttachment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, teamId: true } },
      },
    });

    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found' });
    }

    const allowed = await canAccessFile(fileRecord, ctx);
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.fileAttachment.delete({ where: { id } });

    const filePath = path.join(UPLOAD_DIR, fileRecord.storedName);
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, () => {});
    }

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/files/:id error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/files/:id/view
router.get('/:id/view', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid file id' });
    }

    const ctx = await getRoleContext(req);

    const fileRecord = await prisma.fileAttachment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, teamId: true } },
      },
    });

    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found' });
    }

    const allowed = await canAccessFile(fileRecord, ctx);
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const filePath = path.join(UPLOAD_DIR, fileRecord.storedName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Physical file missing' });
    }

    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(fileRecord.originalName)}"`
    );
    res.setHeader(
      'Content-Type',
      fileRecord.mimeType || 'application/octet-stream'
    );

    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('GET /api/files/:id/view error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
