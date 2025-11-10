// src/api.js
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

export async function apiFetch(path, token, opts = {}) {
  // Ensure path begins with '/'
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE}${normalizedPath}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {})
  };

  // Only add Authorization header when token is a non-empty string
  if (typeof token === 'string' && token.trim() !== '') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...opts, headers });

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    // Prefer server message fields if provided
    const message = data?.message || data?.error || data?.error_description || data?.detail || res.statusText;
    throw new Error(message || `Request failed with ${res.status}`);
  }

  return data;
}
