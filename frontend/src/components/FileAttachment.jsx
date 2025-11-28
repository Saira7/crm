import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from './AuthContext';
import { apiFetch } from '../api';
import { Upload, Trash2, Download } from 'lucide-react';

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export default function FilesPage() {
  const { token } = useContext(AuthContext);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState('');

  const loadFiles = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch('/files', token);
      setFiles(data || []);
    } catch (err) {
      console.error('Failed to load files', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
  };

  // VIEW via blob (with Authorization header)
  const handleView = async (file) => {
    if (!token) return;

    try {
      const res = await fetch(`/api/files/${file.id}/view`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        console.error('Failed to fetch file for view', res.status);
        alert('Failed to open file');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      window.open(url, '_blank');

      // free memory later
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.error('Error opening file', err);
      alert('Error opening file');
    }
  };

  // DOWNLOAD via blob (with Authorization header)
  const handleDownload = async (file) => {
    if (!token) return;

    try {
      const res = await fetch(`/api/files/${file.id}/download`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        console.error('Failed to fetch file for download', res.status);
        alert('Failed to download file');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = file.originalName || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading file', err);
      alert('Error downloading file');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !token) return;

    const formData = new FormData();
    formData.append('file', selectedFile);
    if (description.trim()) {
      formData.append('description', description.trim());
    }

    try {
      setUploading(true);
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Upload failed');
      }

      const created = await res.json();
      setFiles((prev) => [created, ...prev]);
      setSelectedFile(null);
      setDescription('');
      // clear input
      const input = document.getElementById('file-input');
      if (input) input.value = '';
    } catch (err) {
      console.error('Upload failed', err);
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    const ok = window.confirm('Delete this file?');
    if (!ok || !token) return;
    try {
      await apiFetch(`/files/${id}`, token, { method: 'DELETE' });
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      console.error('Delete failed', err);
      alert(err.message || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">File Attachments</h1>
          <p className="text-sm text-gray-500">
            Upload and manage your personal files (any type).
          </p>
        </div>
      </div>

      {/* upload card */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1 space-y-2">
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Select file
            </label>
            <input
              id="file-input"
              type="file"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-700 border border-gray-300 rounded-lg cursor-pointer focus:outline-none"
            />
            {selectedFile && (
              <p className="text-xs text-gray-500 mt-1">
                Selected: <span className="font-medium">{selectedFile.name}</span>{' '}
                ({formatSize(selectedFile.size)})
              </p>
            )}
          </div>

          <div className="flex-1 space-y-2">
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Contract, Proposal, Statement..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div className="sm:self-end">
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 mt-3 sm:mt-0"
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      </div>

      {/* list card */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Your Files</h2>
          <span className="text-xs text-gray-500">
            {files.length} file{files.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="p-4 text-sm text-gray-500">Loading files…</div>
          )}

          {!loading && files.length === 0 && (
            <div className="p-4 text-sm text-gray-500">
              No files uploaded yet. Use the form above to add your first file.
            </div>
          )}

          {files.map((file) => (
            <div
              key={file.id}
              className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleView(file)}
                    className="font-medium text-sm text-blue-600 hover:underline text-left truncate"
                    title="Click to view"
                  >
                    {file.originalName}
                  </button>
                </div>
                {file.description && (
                  <p className="text-xs text-gray-500 truncate">
                    {file.description}
                  </p>
                )}
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {formatSize(file.size)} •{' '}
                  {file.mimeType || 'Unknown type'} •{' '}
                  {file.createdAt
                    ? new Date(file.createdAt).toLocaleString()
                    : ''}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(file)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50"
                >
                  <Download className="w-3 h-3" />
                  Download
                </button>
                <button
                  onClick={() => handleDelete(file.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-xs text-red-600 hover:bg-red-100"
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
