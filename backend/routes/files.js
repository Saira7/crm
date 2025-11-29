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
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || '');
    cb(null, unique + ext);
  },
});

const upload = multer({ storage });

/**
 * Helper: normalize role & get user's teamId from DB
 */
async function getRoleAndTeam(req) {
  const userId = req.user?.userId;
  let rawRole = null;

  // role might be string or object with name
  if (req.user?.role) {
    if (typeof req.user.role === 'string') {
      rawRole = req.user.role;
    } else if (req.user.role.name) {
      rawRole = req.user.role.name;
    }
  }

  const role = rawRole ? String(rawRole).toLowerCase() : 'user';

  // fetch user to get teamId (in case it's not in token)
  let teamId = null;
  if (userId) {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { teamId: true },
    });
    teamId = dbUser?.teamId ?? null;
  }

  const isAdmin = role === 'admin';
  const isTeamLead = role === 'team_lead' || role === 'team lead';

  return { userId, role, isAdmin, isTeamLead, teamId };
}

// GET /api/files
// Admin: all files
// Team Lead: files of users in their team
// Normal user: only their own files
router.get('/', requireAuth, async (req, res) => {
  try {
    const { userId, isAdmin, isTeamLead, teamId } = await getRoleAndTeam(req);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let where = {};

    if (isAdmin) {
      // all files
      where = {};
    } else if (isTeamLead && teamId) {
      // files of users in the same team
      where = {
        user: { teamId },
      };
    } else {
      // only own files
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

// POST /api/files  (multipart/form-data)
// fields: file (binary), description (text, optional)
router.post(
  '/',
  requireAuth,
  upload.single('file'),
  async (req, res) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        // clean up uploaded file if no user
        if (req.file) {
          fs.unlink(req.file.path, () => {});
        }
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

// GET /api/files/:id/download  -> stream file
router.get('/:id/download', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid file id' });
    }

    const { userId, isAdmin, isTeamLead, teamId } = await getRoleAndTeam(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileRecord = await prisma.fileAttachment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, teamId: true } },
      },
    });

    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found' });
    }

    const sameOwner = fileRecord.userId === userId;
    const sameTeam =
      isTeamLead && !!teamId && fileRecord.user && fileRecord.user.teamId === teamId;

    if (!isAdmin && !sameOwner && !sameTeam) {
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

    const { userId, isAdmin, isTeamLead, teamId } = await getRoleAndTeam(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileRecord = await prisma.fileAttachment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, teamId: true } },
      },
    });

    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found' });
    }

    const sameOwner = fileRecord.userId === userId;
    const sameTeam =
      isTeamLead && !!teamId && fileRecord.user && fileRecord.user.teamId === teamId;

    if (!isAdmin && !sameOwner && !sameTeam) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // delete db record
    await prisma.fileAttachment.delete({ where: { id } });

    // delete physical file
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

// GET /api/files/:id/view  -> inline view (browser tries to display it)
router.get('/:id/view', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid file id' });
    }

    const { userId, isAdmin, isTeamLead, teamId } = await getRoleAndTeam(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileRecord = await prisma.fileAttachment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, teamId: true } },
      },
    });

    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found' });
    }

    const sameOwner = fileRecord.userId === userId;
    const sameTeam =
      isTeamLead && !!teamId && fileRecord.user && fileRecord.user.teamId === teamId;

    if (!isAdmin && !sameOwner && !sameTeam) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const filePath = path.join(UPLOAD_DIR, fileRecord.storedName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Physical file missing' });
    }

    // Let browser decide how to show it (PDF/image opens in tab, etc.)
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
