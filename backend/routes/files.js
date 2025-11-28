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

// GET /api/files  -> list current user's attachments
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const files = await prisma.fileAttachment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
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

    const userId = req.user?.userId;
    const isAdmin =
      (req.user?.role && String(req.user.role).toLowerCase() === 'admin') ||
      (req.user?.role?.name &&
        String(req.user.role.name).toLowerCase() === 'admin');

    const fileRecord = await prisma.fileAttachment.findUnique({
      where: { id },
    });

    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (!isAdmin && fileRecord.userId !== userId) {
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
    res.setHeader('Content-Type', fileRecord.mimeType || 'application/octet-stream');

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

    const userId = req.user?.userId;
    const isAdmin =
      (req.user?.role && String(req.user.role).toLowerCase() === 'admin') ||
      (req.user?.role?.name &&
        String(req.user.role.name).toLowerCase() === 'admin');

    const fileRecord = await prisma.fileAttachment.findUnique({
      where: { id },
    });
    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (!isAdmin && fileRecord.userId !== userId) {
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

module.exports = router;
