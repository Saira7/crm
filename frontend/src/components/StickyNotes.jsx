// src/components/StickyNotesPanel.jsx
import React, { useEffect, useState, useContext } from 'react';
import { apiFetch } from '../api';
import { X, Plus, Pin, PinOff, Trash2 } from 'lucide-react';
import { AuthContext } from './AuthContext';

export default function StickyNotesPanel({ token, isOpen, onClose }) {
  const { token: ctxToken } = useContext(AuthContext);

  // Use prop token if provided, otherwise use AuthContext token
  const effectiveToken = token || ctxToken;

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newContent, setNewContent] = useState('');
  const [newTitle, setNewTitle] = useState('');

  const loadNotes = async () => {
    if (!effectiveToken) return;
    setLoading(true);
    try {
      const data = await apiFetch('/notes', effectiveToken);
      setNotes(data || []);
    } catch (err) {
      console.error('Failed to load notes', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Default: when used as a page (no isOpen prop) -> load notes
    if (isOpen === undefined || isOpen) {
      loadNotes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, effectiveToken]);

  const handleCreate = async () => {
    if (!newContent.trim() || !effectiveToken) return;
    try {
      setSaving(true);
      const created = await apiFetch('/notes', effectiveToken, {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle || null,
          content: newContent,
        }),
      });
      setNotes((prev) => [created, ...prev]);
      setNewContent('');
      setNewTitle('');
    } catch (err) {
      console.error('Create note failed', err);
      alert(err.message || 'Failed to create note');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id, patch) => {
    if (!effectiveToken) return;
    try {
      const updated = await apiFetch(`/notes/${id}`, effectiveToken, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
    } catch (err) {
      console.error('Update note failed', err);
      alert(err.message || 'Failed to update note');
    }
  };

  const handleDelete = async (id) => {
    if (!effectiveToken) return;
    const ok = window.confirm('Delete this note?');
    if (!ok) return;
    try {
      await apiFetch(`/notes/${id}`, effectiveToken, { method: 'DELETE' });
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error('Delete note failed', err);
      alert(err.message || 'Failed to delete note');
    }
  };

  // Default open: if isOpen is undefined (route case), treat as true
  const open = isOpen !== false;
  if (!open) return null;

  // Default onClose: no-op if not provided (route case)
  const handleClose = onClose || (() => {});

  if (!effectiveToken) {
    // Should not really happen since AuthContext has token, but just in case
    return (
      <div className="p-4 text-sm text-red-500">
        Not authenticated. Please log in again.
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* backdrop */}
      <div
        className="flex-1 bg-black bg-opacity-30"
        onClick={handleClose}
      />

      {/* panel */}
      <div className="w-full max-w-md bg-white h-full shadow-xl flex flex-col">
        {/* header */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Sticky Notes</h2>
            <p className="text-xs text-gray-500">
              Quick personal notes. Only you can see these.
            </p>
          </div>
          <button
            className="p-1 rounded hover:bg-gray-100"
            onClick={handleClose}
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* new note form */}
        <div className="p-4 border-b space-y-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full px-3 py-2 border rounded-lg text-xs mb-1"
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Write a quick note..."
            rows={3}
            className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
          />
          <div className="flex justify-end">
            <button
              onClick={handleCreate}
              disabled={saving || !newContent.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-50"
            >
              <Plus className="w-3 h-3" />
              Add Note
            </button>
          </div>
        </div>

        {/* notes list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="text-xs text-gray-500">Loading notes…</div>
          )}

          {!loading && notes.length === 0 && (
            <div className="text-xs text-gray-500">
              No notes yet. Add your first one above.
            </div>
          )}

          {notes.map((note) => (
            <div
              key={note.id}
              className="border rounded-lg p-3 bg-yellow-50 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <input
                  className="flex-1 bg-transparent text-xs font-semibold text-gray-800 focus:outline-none"
                  value={note.title || ''}
                  placeholder="Title"
                  onChange={(e) =>
                    handleUpdate(note.id, { title: e.target.value })
                  }
                />
                <button
                  onClick={() =>
                    handleUpdate(note.id, { pinned: !note.pinned })
                  }
                  className="p-1 rounded hover:bg-yellow-100 flex-shrink-0"
                  title={note.pinned ? 'Unpin' : 'Pin'}
                >
                  {note.pinned ? (
                    <Pin className="w-3 h-3 text-yellow-700" />
                  ) : (
                    <PinOff className="w-3 h-3 text-gray-400" />
                  )}
                </button>
              </div>

              <textarea
                className="w-full bg-transparent text-xs text-gray-800 resize-none focus:outline-none"
                rows={3}
                value={note.content}
                onChange={(e) =>
                  handleUpdate(note.id, { content: e.target.value })
                }
              />

              <div className="flex items-center justify-between text-[10px] text-gray-400">
                <span>
                  Updated{' '}
                  {note.updatedAt
                    ? new Date(note.updatedAt).toLocaleString()
                    : ''}
                </span>
                <button
                  onClick={() => handleDelete(note.id)}
                  className="inline-flex items-center gap-1 text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
