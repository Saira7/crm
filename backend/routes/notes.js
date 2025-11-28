// backend/routes/notes.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');

const prisma = new PrismaClient();
const router = express.Router();

/**
 * GET /api/notes
 * Get all notes for the logged-in user (most recent first, pinned first).
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const notes = await prisma.stickyNote.findMany({
      where: { userId },
      orderBy: [
        { pinned: 'desc' },
        { updatedAt: 'desc' }
      ]
    });

    res.json(notes);
  } catch (err) {
    console.error('GET /api/notes error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/notes
 * Create a new note for the logged-in user.
 * Body: { title?, content, color?, pinned? }
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { title, content, color, pinned } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const note = await prisma.stickyNote.create({
      data: {
        userId,
        title: title ? String(title).trim() : null,
        content: String(content).trim(),
        color: color || null,
        pinned: !!pinned,
      },
    });

    res.status(201).json(note);
  } catch (err) {
    console.error('POST /api/notes error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/notes/:id
 * Update a note belonging to the logged-in user.
 */
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid note id' });
    }

    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const existing = await prisma.stickyNote.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const { title, content, color, pinned } = req.body || {};
    const data = {};

    if (title !== undefined) {
      data.title = title ? String(title).trim() : null;
    }
    if (content !== undefined) {
      if (!content || !String(content).trim()) {
        return res.status(400).json({ error: 'Content cannot be empty' });
      }
      data.content = String(content).trim();
    }
    if (color !== undefined) {
      data.color = color || null;
    }
    if (pinned !== undefined) {
      data.pinned = !!pinned;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updated = await prisma.stickyNote.update({
      where: { id },
      data,
    });

    res.json(updated);
  } catch (err) {
    console.error('PATCH /api/notes/:id error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/notes/:id
 * Delete a note belonging to the logged-in user.
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid note id' });
    }

    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const existing = await prisma.stickyNote.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ error: 'Note not found' });
    }

    await prisma.stickyNote.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/notes/:id error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
