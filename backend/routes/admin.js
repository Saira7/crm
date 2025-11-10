// backend/routes/admin.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
const router = express.Router();

// // Try to reuse application auth middleware (if present)
// let requireAuth;
// try {
//   requireAuth = require('../middleware/auth').requireAuth;
// } catch (e) {
//   // If not present, fallback to a noop that just calls next()
//   requireAuth = (req, res, next) => next();
// }

// // Basic admin-check middleware (in-file). This expects req.user to be set by requireAuth.
// function requireAdmin(req, res, next) {
//   if (!req.user) {
//     return res.status(401).json({ error: 'Authentication required' });
//   }
//   // If req.user.role is an object, handle both string or object
//   const role = typeof req.user.role === 'string' ? req.user.role : (req.user.role?.name || req.user.role?.role || '');
//   if (!role || role !== 'admin') {
//     return res.status(403).json({ error: 'Admin role required' });
//   }
//   next();
// }

// // Apply auth + admin middleware to all admin API routes (including HTML)
// router.use(requireAuth, requireAdmin);

// Serve the admin panel HTML
router.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>CRM Admin Panel</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
  <div class="min-h-screen py-8">
    <div class="max-w-6xl mx-auto px-4">
      <!-- Header -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h1 class="text-3xl font-bold text-gray-900">CRM Admin Panel</h1>
        <p class="text-gray-600 mt-1">Manage teams, users, roles and IP restrictions</p>
      </div>

      <!-- Alerts -->
      <div id="alert-success" class="hidden mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg"><span id="success-message"></span></div>
      <div id="alert-error" class="hidden mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg"><span id="error-message"></span></div>

      <!-- Tabs -->
      <div class="mb-6">
        <div class="border-b border-gray-200">
          <nav class="flex space-x-8">
            <button onclick="showTab('roles')" id="tab-roles" class="tab-button border-b-2 border-blue-500 py-4 px-1 text-sm font-medium text-blue-600">Roles</button>
            <button onclick="showTab('teams')" id="tab-teams" class="tab-button border-b-2 border-transparent py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300">Teams</button>
            <button onclick="showTab('users')" id="tab-users" class="tab-button border-b-2 border-transparent py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300">Users</button>
            <button onclick="showTab('ip')" id="tab-ip" class="tab-button border-b-2 border-transparent py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300">IP Restrictions</button>
          </nav>
        </div>
      </div>

      <!-- Roles -->
      <div id="content-roles" class="tab-content">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 class="text-xl font-bold text-gray-900 mb-4">Add New Role</h2>
            <form onsubmit="addRole(event)">
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Role Name</label>
                <input id="role-name" required class="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="e.g., admin, team_lead, sales_rep" />
              </div>
              <button class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg">Add Role</button>
            </form>
          </div>

          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 class="text-xl font-bold text-gray-900 mb-4">Existing Roles</h2>
            <div id="roles-list" class="space-y-2"></div>
          </div>
        </div>
      </div>

      <!-- Teams -->
      <div id="content-teams" class="tab-content hidden">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 class="text-xl font-bold text-gray-900 mb-4">Add New Team</h2>
            <form onsubmit="addTeam(event)">
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Team Name</label>
                <input id="team-name" required class="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="e.g., Sales Team Alpha" />
              </div>
              <button class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg">Add Team</button>
            </form>
          </div>

          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 class="text-xl font-bold text-gray-900 mb-4">Existing Teams</h2>
            <div id="teams-list" class="space-y-2"></div>
          </div>
        </div>
      </div>

      <!-- Users -->
      <div id="content-users" class="tab-content hidden">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 class="text-xl font-bold text-gray-900 mb-4">Add New User</h2>
            <form onsubmit="addUser(event)">
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input id="user-name" required class="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="John Doe" />
              </div>
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input id="user-email" required type="email" class="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="john@example.com" />
              </div>
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input id="user-password" required type="password" class="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="password" />
              </div>
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select id="user-role" required class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                  <option value="">Select a role...</option>
                </select>
              </div>
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Team (optional)</label>
                <select id="user-team" class="w-full px-4 py-2 border border-gray-300 rounded-lg"><option value="">No team</option></select>
              </div>
              <button class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg">Add User</button>
            </form>
          </div>

          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 class="text-xl font-bold text-gray-900 mb-4">Existing Users</h2>
            <div id="users-list" class="space-y-3 max-h-[600px] overflow-y-auto"></div>
          </div>
        </div>
      </div>

      <!-- IP Restrictions -->
      <div id="content-ip" class="tab-content hidden">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 class="text-xl font-bold text-gray-900 mb-4">Add IP Restriction</h2>

            <form onsubmit="addIPRestriction(event)">
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select id="ip-type" onchange="handleIPTypeChange()" class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                  <option value="role">Role-based Restriction</option>
                  <option value="user">User-based Restriction</option>
                </select>
              </div>

              <div id="role-select-container" class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select id="ip-role" class="w-full px-4 py-2 border border-gray-300 rounded-lg"><option value="">Select a role...</option></select>
              </div>

              <div id="user-select-container" class="mb-4 hidden">
                <label class="block text-sm font-medium text-gray-700 mb-2">User</label>
                <select id="ip-user" class="w-full px-4 py-2 border border-gray-300 rounded-lg"><option value="">Select a user...</option></select>
              </div>

              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">IP Address</label>
                <input id="ip-address" required class="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="192.168.1.1 or 192.168.1.0/24 or 192.168.1.*" />
                <p class="text-xs text-gray-500 mt-1">Supports: single IP, CIDR, wildcard</p>
              </div>

              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Description (optional)</label>
                <input id="ip-description" class="w-full px-4 py-2 border border-gray-300 rounded-lg" />
              </div>

              <button class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg">Add IP Restriction</button>
            </form>

            <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p class="text-sm font-medium text-blue-900">Your Current IP:</p>
              <p id="current-ip" class="text-lg font-bold text-blue-700">Loading...</p>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 class="text-xl font-bold text-gray-900 mb-4">Active IP Restrictions</h2>
            <div id="ip-list" class="space-y-3 max-h-[600px] overflow-y-auto"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    // Utilities
    function showSuccess(message) {
      document.getElementById('success-message').textContent = message;
      document.getElementById('alert-success').classList.remove('hidden');
      document.getElementById('alert-error').classList.add('hidden');
      setTimeout(() => document.getElementById('alert-success').classList.add('hidden'), 4000);
    }
    function showError(message) {
      document.getElementById('error-message').textContent = message;
      document.getElementById('alert-error').classList.remove('hidden');
      document.getElementById('alert-success').classList.add('hidden');
    }

    // Tabs
    function showTab(tab) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
      document.querySelectorAll('.tab-button').forEach(el => {
        el.classList.remove('border-blue-500','text-blue-600');
        el.classList.add('border-transparent','text-gray-500');
      });
      document.getElementById('content-' + tab).classList.remove('hidden');
      document.getElementById('tab-' + tab).classList.remove('border-transparent','text-gray-500');
      document.getElementById('tab-' + tab).classList.add('border-blue-500','text-blue-600');
    }

    // Init
    document.addEventListener('DOMContentLoaded', () => {
      loadRoles(); loadTeams(); loadUsers(); loadIPRestrictions(); loadCurrentIP();
      showTab('roles');
    });

    // -----------------------------
    // Roles
    // -----------------------------
    async function addRole(e) {
      e.preventDefault();
      const name = document.getElementById('role-name').value.trim();
      if (!name) return showError('Role name required');
      try {
        const res = await fetch('/admin/roles', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (res.ok) {
          showSuccess('Role added');
          document.getElementById('role-name').value = '';
          loadRoles();
        } else showError(data.error || 'Failed to add role');
      } catch (err) { showError('Error: ' + err.message); }
    }

    async function loadRoles() {
      try {
        const res = await fetch('/admin/roles');
        const roles = await res.json();
        window.rolesData = roles;
        const rolesList = document.getElementById('roles-list');
        rolesList.innerHTML = roles.map(role =>
          '<div class="p-3 bg-gray-50 rounded-lg flex items-center justify-between">' +
          '<div><span class="font-medium text-gray-900">' + role.name + '</span> <span class="text-sm text-gray-500 ml-2">(ID: ' + role.id + ')</span>' +
          (role.ipRestricted ? ' <span class="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded">IP Restricted</span>' : '') +
          '</div>' +
          '<div class="flex gap-2">' +
          '<button onclick="confirmDeleteRole(' + role.id + ')" class="px-3 py-1 text-xs bg-red-100 text-red-700 rounded">Delete</button>' +
          '</div></div>'
        ).join('');
        // Update user-role select
        const userRoleSelect = document.getElementById('user-role');
        userRoleSelect.innerHTML = '<option value="">Select a role...</option>' + roles.map(r => '<option value="' + r.id + '">' + r.name + '</option>').join('');
      } catch (err) {
        showError('Failed to load roles');
      }
    }

    function confirmDeleteRole(id) {
      if (!id) return;
      if (!confirm('Delete role? This will fail if users are still assigned.')) return;
      deleteRole(id);
    }
    async function deleteRole(id) {
      try {
        const res = await fetch('/admin/roles/' + id, { method: 'DELETE' });
        const data = await res.json().catch(()=>null);
        if (res.ok) { showSuccess('Role deleted'); loadRoles(); loadUsers(); }
        else showError((data && data.error) || 'Failed to delete role');
      } catch (err) { showError('Error deleting role: ' + err.message); }
    }

    // -----------------------------
    // Teams
    // -----------------------------
    async function addTeam(e) {
      e.preventDefault();
      const name = document.getElementById('team-name').value.trim();
      if (!name) return showError('Team name required');
      try {
        const res = await fetch('/admin/teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
        const data = await res.json();
        if (res.ok) { showSuccess('Team added'); document.getElementById('team-name').value = ''; loadTeams(); }
        else showError(data.error || 'Failed to add team');
      } catch (err) { showError('Error: ' + err.message); }
    }

    async function loadTeams() {
      try {
        const res = await fetch('/admin/teams');
        const teams = await res.json();
        window.teamsData = teams;
        const teamsList = document.getElementById('teams-list');
        teamsList.innerHTML = teams.map(team =>
          '<div class="p-3 bg-gray-50 rounded-lg flex items-center justify-between">' +
          '<div><span class="font-medium text-gray-900">' + team.name + '</span> <span class="text-sm text-gray-500 ml-2">(ID: ' + team.id + ')</span></div>' +
          '<div><button onclick="confirmDeleteTeam(' + team.id + ')" class="px-3 py-1 text-xs bg-red-100 text-red-700 rounded">Delete</button></div>' +
          '</div>'
        ).join('');
        const userTeamSelect = document.getElementById('user-team');
        userTeamSelect.innerHTML = '<option value="">No team</option>' + teams.map(t => '<option value="' + t.id + '">' + t.name + '</option>').join('');
      } catch (err) { showError('Failed to load teams'); }
    }

    function confirmDeleteTeam(id) {
      if (!id) return;
      if (!confirm('Delete team? This will fail if members are still assigned.')) return;
      deleteTeam(id);
    }
    async function deleteTeam(id) {
      try {
        const res = await fetch('/admin/teams/' + id, { method: 'DELETE' });
        const data = await res.json().catch(()=>null);
        if (res.ok) { showSuccess('Team deleted'); loadTeams(); loadUsers(); }
        else showError((data && data.error) || 'Failed to delete team');
      } catch (err) { showError('Error deleting team: ' + err.message); }
    }

    // -----------------------------
    // Users
    // -----------------------------
    async function addUser(e) {
      e.preventDefault();
      const name = document.getElementById('user-name').value.trim();
      const email = document.getElementById('user-email').value.trim();
      const password = document.getElementById('user-password').value;
      const roleId = parseInt(document.getElementById('user-role').value || 0, 10);
      const teamId = document.getElementById('user-team').value ? parseInt(document.getElementById('user-team').value, 10) : null;
      if (!name || !email || !password || !roleId) return showError('All required fields must be filled');
      try {
        const res = await fetch('/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password, roleId, teamId }) });
        const data = await res.json();
        if (res.ok) { showSuccess('User added'); document.getElementById('user-name').value=''; document.getElementById('user-email').value=''; document.getElementById('user-password').value=''; document.getElementById('user-role').value=''; document.getElementById('user-team').value=''; loadUsers(); }
        else showError(data.error || 'Failed to add user');
      } catch (err) { showError('Error: ' + err.message); }
    }

    async function loadUsers() {
      try {
        const res = await fetch('/admin/users');
        const users = await res.json();
        window.usersData = users;
        const usersList = document.getElementById('users-list');
        usersList.innerHTML = users.map(user =>
          '<div class="p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-start justify-between">' +
          '<div>' +
          '<div class="font-medium text-gray-900">' + user.name + '</div>' +
          '<div class="text-sm text-gray-600">' + user.email + '</div>' +
          '<div class="flex gap-2 mt-2">' +
          '<span class="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">' + (user.role?.name || 'No role') + '</span>' +
          (user.team ? ' <span class="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">' + user.team.name + '</span>' : '') +
          (user.ipRestricted ? ' <span class="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded">IP Restricted</span>' : '') +
          '</div>' +
          (user.lastLoginIP ? '<div class="text-xs text-gray-500 mt-2">Last IP: ' + user.lastLoginIP + '</div>' : '') +
          '</div>' +
          '<div class="flex flex-col gap-2">' +
          '<button onclick="confirmDeleteUser(' + user.id + ')" class="px-3 py-1 text-xs bg-red-100 text-red-700 rounded">Delete</button>' +
          '</div></div>'
        ).join('');
      } catch (err) { showError('Failed to load users'); }
    }

    function confirmDeleteUser(id) {
      if (!id) return;
      if (!confirm('Delete user? This will unassign their leads and permanently remove the account.')) return;
      deleteUser(id);
    }
    async function deleteUser(id) {
      try {
        const res = await fetch('/admin/users/' + id, { method: 'DELETE' });
        const data = await res.json().catch(()=>null);
        if (res.ok) { showSuccess('User deleted'); loadUsers(); loadRoles(); loadTeams(); loadIPRestrictions(); }
        else showError((data && data.error) || 'Failed to delete user');
      } catch (err) { showError('Error deleting user: ' + err.message); }
    }

    // -----------------------------
    // IP Restrictions
    // -----------------------------
    function handleIPTypeChange() {
      const type = document.getElementById('ip-type').value;
      if (type === 'role') {
        document.getElementById('role-select-container').classList.remove('hidden');
        document.getElementById('user-select-container').classList.add('hidden');
      } else {
        document.getElementById('role-select-container').classList.add('hidden');
        document.getElementById('user-select-container').classList.remove('hidden');
      }
    }

    async function addIPRestriction(e) {
      e.preventDefault();
      const type = document.getElementById('ip-type').value;
      const roleId = type === 'role' ? parseInt(document.getElementById('ip-role').value) : null;
      const userId = type === 'user' ? parseInt(document.getElementById('ip-user').value) : null;
      const ipAddress = document.getElementById('ip-address').value.trim();
      const description = document.getElementById('ip-description').value.trim();

      if (type === 'role' && !roleId) return showError('Select a role');
      if (type === 'user' && !userId) return showError('Select a user');
      if (!ipAddress) return showError('IP address required');

      try {
        const res = await fetch('/admin/ip-restrictions', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type, roleId, userId, ipAddress, description }) });
        const data = await res.json();
        if (res.ok) { showSuccess('IP restriction added'); document.getElementById('ip-address').value=''; document.getElementById('ip-description').value=''; loadIPRestrictions(); }
        else showError(data.error || 'Failed to add IP restriction');
      } catch (err) { showError('Error: ' + err.message); }
    }

    // Replace your existing loadIPRestrictions() with this improved version
async function loadIPRestrictions() {
  console.log('[admin] loadIPRestrictions() called');
  try {
    const res = await fetch('/admin/ip-restrictions', { cache: 'no-store' });
    if (!res.ok) {
      const text = await res.text().catch(()=>null);
      console.error('[admin] ip-restrictions fetch failed', res.status, text);
      return showError('Failed to fetch IP restrictions (status ' + res.status + ')');
    }

    const restrictions = await res.json().catch(err => {
      console.error('[admin] failed to parse /admin/ip-restrictions json', err);
      showError('Invalid JSON from server for ip restrictions');
      return null;
    });
    if (!restrictions) return;

    console.log('[admin] ip restrictions received', restrictions);

    const ipList = document.getElementById('ip-list');
    const ipRoleSelect = document.getElementById('ip-role');
    const ipUserSelect = document.getElementById('ip-user');

    // Helper to escape HTML inserted into innerHTML to avoid injection
    function escapeHTML(s){
      if (s === null || s === undefined) return '';
      return String(s)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;');
    }

    if (!Array.isArray(restrictions) || restrictions.length === 0) {
      if (ipList) ipList.innerHTML = '<p class="text-gray-500 text-center py-8">No IP restrictions configured</p>';
    } else {
      // Build HTML safely
      const rows = restrictions.map((r, idx) => {
        const typeLabel = r.type === 'role' ? 'Role' : (r.type === 'user' ? 'User' : escapeHTML(r.type));
        const targetName = escapeHTML(r.roleName || r.userName || r.userEmail || 'Unknown');
        const ipAddr = escapeHTML(r.ipAddress);
        const desc = r.description ? ('<div class="text-xs text-gray-600">' + escapeHTML(r.description) + '</div>') : '';
        const created = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '';
        const isActive = !!r.isActive;
        // safe id string for user-based pseudo-ids
        const safeId = escapeHTML(String(r.id));

        // buttons: use data-* instead of injecting raw JS code to avoid quoting issues
        return (
          '<div class="p-4 bg-gray-50 rounded-lg border border-gray-200">' +
            '<div class="flex items-start justify-between">' +
              '<div class="flex-1">' +
                '<div class="flex items-center gap-2 mb-2">' +
                  '<span class="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">' + typeLabel + '</span>' +
                  '<span class="font-medium text-gray-900">' + targetName + '</span>' +
                '</div>' +
                '<div class="font-mono text-sm text-gray-900 mb-1">' + ipAddr + '</div>' +
                desc +
                (created ? ('<div class="text-xs text-gray-500 mt-2">Added: ' + escapeHTML(created) + '</div>') : '') +
              '</div>' +
              '<div class="flex flex-col gap-2 ml-4">' +
                '<button data-restr-id="' + safeId + '" data-restr-active="' + (isActive ? '1' : '0') + '" class="ip-toggle-btn px-3 py-1 text-xs rounded ' + (isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700') + '">' + (isActive ? 'Active' : 'Inactive') + '</button>' +
                '<button data-restr-id="' + safeId + '" class="ip-delete-btn px-3 py-1 text-xs rounded bg-red-100 text-red-700">Delete</button>' +
              '</div>' +
            '</div>' +
          '</div>'
        );
      });

      if (ipList) ipList.innerHTML = rows.join('');
    }

    // populate selects if elements exist and data loaded earlier
    if (ipRoleSelect && Array.isArray(window.rolesData)) {
      ipRoleSelect.innerHTML = '<option value="">Select a role...</option>' + window.rolesData.map(role => '<option value="' + escapeHTML(role.id) + '">' + escapeHTML(role.name) + '</option>').join('');
    }
    if (ipUserSelect && Array.isArray(window.usersData)) {
      ipUserSelect.innerHTML = '<option value="">Select a user...</option>' + window.usersData.map(u => '<option value="' + escapeHTML(u.id) + '">' + escapeHTML(u.name) + ' (' + escapeHTML(u.email) + ')</option>').join('');
    }

    // Attach delegated event handlers for toggle / delete (so we don't need inline onclicks)
    const container = document.getElementById('ip-list');
    if (container) {
      // remove previous listeners (simple approach: replace container to remove old listeners)
      // but here we will attach a single click handler (idempotent)
      if (!container._adminHandlersAttached) {
        container.addEventListener('click', async (ev) => {
          const btn = ev.target.closest('button');
          if (!btn) return;
          if (btn.classList.contains('ip-toggle-btn')) {
            const id = btn.getAttribute('data-restr-id');
            const active = btn.getAttribute('data-restr-active') === '1';
            try {
              const target = String(id);
              const newActive = !active;
              const patchRes = await fetch('/admin/ip-restrictions/' + encodeURIComponent(target), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: newActive })
              });
              if (!patchRes.ok) {
                const txt = await patchRes.text().catch(()=>null);
                console.error('[admin] toggle patch failed', patchRes.status, txt);
                return showError('Failed to update IP restriction');
              }
              showSuccess('IP restriction updated');
              await loadIPRestrictions();
              if (typeof loadRoles === 'function') loadRoles();
              if (typeof loadUsers === 'function') loadUsers();
            } catch (err) {
              console.error('[admin] toggle error', err);
              showError('Error updating IP restriction: ' + err.message);
            }
          } else if (btn.classList.contains('ip-delete-btn')) {
            const id = btn.getAttribute('data-restr-id');
            if (!confirm('Delete this IP restriction? This cannot be undone.')) return;
            try {
              const delRes = await fetch('/admin/ip-restrictions/' + encodeURIComponent(String(id)), { method: 'DELETE' });
              if (!delRes.ok) {
                const txt = await delRes.text().catch(()=>null);
                console.error('[admin] delete failed', delRes.status, txt);
                return showError('Failed to delete IP restriction');
              }
              showSuccess('IP restriction deleted');
              await loadIPRestrictions();
              if (typeof loadRoles === 'function') loadRoles();
              if (typeof loadUsers === 'function') loadUsers();
            } catch (err) {
              console.error('[admin] delete error', err);
              showError('Error deleting IP restriction: ' + err.message);
            }
          }
        });
        container._adminHandlersAttached = true;
      }
    }

  } catch (err) {
    console.error('[admin] loadIPRestrictions error', err);
    showError('Failed to load IP restrictions: ' + err.message);
  }
}


    async function toggleIPRestriction(id, isActive) {
      try {
        const res = await fetch('/admin/ip-restrictions/' + encodeURIComponent(id), { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ isActive }) });
        if (res.ok) { showSuccess('IP restriction updated'); loadIPRestrictions(); loadRoles(); loadUsers(); }
        else { showError('Failed to update IP restriction'); }
      } catch (err) { showError('Error: ' + err.message); }
    }

    function confirmDeleteIP(id) {
      if (!id) return;
      if (!confirm('Are you sure you want to delete this IP restriction? This cannot be undone.')) return;
      deleteIPRestriction(id);
    }
    async function deleteIPRestriction(id) {
      try {
        const res = await fetch('/admin/ip-restrictions/' + encodeURIComponent(id), { method: 'DELETE' });
        const data = await res.json().catch(()=>null);
        if (res.ok) { showSuccess('IP restriction deleted'); loadIPRestrictions(); loadRoles(); loadUsers(); }
        else showError((data && data.error) || 'Failed to delete IP restriction');
      } catch (err) { showError('Error deleting IP restriction: ' + err.message); }
    }

    // get current external IP
    async function loadCurrentIP() {
      try {
        const r = await fetch('https://api.ipify.org?format=json');
        const j = await r.json();
        document.getElementById('current-ip').textContent = j.ip || '—';
      } catch (e) {
        document.getElementById('current-ip').textContent = 'Unable to detect';
      }
    }
  </script>
</body>
</html>`);
});

// ----------------------
// API endpoints (protected by requireAuth + requireAdmin via router.use above)
// ----------------------

// Roles
router.get('/roles', async (req, res) => {
  try {
    const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } });
    res.json(roles);
  } catch (err) {
    console.error('get roles error', err);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

router.post('/roles', async (req, res) => {
  try {
    const { name } = req.body;
    const role = await prisma.role.create({ data: { name } });
    res.json(role);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Role already exists' });
    console.error('create role error', err);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

// Teams
router.get('/teams', async (req, res) => {
  try {
    const teams = await prisma.team.findMany({ orderBy: { name: 'asc' } });
    res.json(teams);
  } catch (err) {
    console.error('get teams error', err);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

router.post('/teams', async (req, res) => {
  try {
    const { name } = req.body;
    const team = await prisma.team.create({ data: { name } });
    res.json(team);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Team already exists' });
    console.error('create team error', err);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Users
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { role: true, team: true },
      orderBy: { name: 'asc' }
    });
    res.json(users);
  } catch (err) {
    console.error('get users error', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/users', async (req, res) => {
  try {
    const { name, email, password, roleId, teamId } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashed, roleId, teamId: teamId || null },
      include: { role: true, team: true }
    });
    res.json(user);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Email already exists' });
    console.error('create user error', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// IP restrictions list (role-based rows + user allowedIPs expanded)
router.get('/ip-restrictions', async (req, res) => {
  try {
    const roleRestrictions = await prisma.iPRestriction.findMany({
      where: { roleId: { not: null } },
      include: { role: true },
      orderBy: { createdAt: 'desc' }
    });

    const userRestrictions = await prisma.user.findMany({
      where: { ipRestricted: true, allowedIPs: { isEmpty: false } },
      select: { id: true, name: true, email: true, allowedIPs: true, ipRestricted: true, createdAt: true, updatedAt: true }
    });

    const all = [
      ...roleRestrictions.map(r => ({
        id: r.id,
        type: 'role',
        roleId: r.roleId,
        roleName: r.role?.name,
        ipAddress: r.ipAddress,
        description: r.description,
        isActive: r.isActive,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
      })),
      ...userRestrictions.flatMap(u =>
        (u.allowedIPs || []).map((ip, idx) => ({
          id: `user-${u.id}-${idx}`,
          type: 'user',
          userId: u.id,
          userName: u.name,
          userEmail: u.email,
          ipAddress: ip,
          description: null,
          isActive: u.ipRestricted,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt
        }))
      )
    ];

    res.json(all);
  } catch (err) {
    console.error('get ipRestrictions error', err);
    res.status(500).json({ error: 'Failed to fetch IP restrictions' });
  }
});

router.post('/ip-restrictions', async (req, res) => {
  try {
    const { type, roleId, userId, ipAddress, description } = req.body;

    if (type === 'role' && roleId) {
      const restriction = await prisma.iPRestriction.create({
        data: { roleId, ipAddress, description, isActive: true },
        include: { role: true }
      });
      // mark role ipRestricted
      await prisma.role.update({ where: { id: roleId }, data: { ipRestricted: true } });
      return res.json(restriction);
    } else if (type === 'user' && userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const updated = [...(user.allowedIPs || []), ipAddress];
      await prisma.user.update({ where: { id: userId }, data: { allowedIPs: { set: updated }, ipRestricted: true } });
      return res.json({ id: `user-${userId}`, type: 'user', userId, ipAddress, isActive: true });
    } else {
      return res.status(400).json({ error: 'Invalid type or missing ID' });
    }
  } catch (err) {
    console.error('create ip restriction error', err);
    res.status(500).json({ error: 'Failed to create IP restriction' });
  }
});

router.patch('/ip-restrictions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (String(id).startsWith('user-')) {
      const userId = parseInt(id.split('-')[1], 10);
      if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });
      await prisma.user.update({ where: { id: userId }, data: { ipRestricted: !!isActive } });
      return res.json({ success: true });
    } else {
      const numericId = parseInt(id, 10);
      if (isNaN(numericId)) return res.status(400).json({ error: 'Invalid restriction id' });
      const update = await prisma.iPRestriction.update({ where: { id: numericId }, data: { isActive } });
      return res.json(update);
    }
  } catch (err) {
    console.error('patch ipRestriction error', err);
    res.status(500).json({ error: 'Failed to update IP restriction' });
  }
});

// ----------------------
// DELETE handlers (roles, teams, users, ip-restrictions)
// ----------------------

// DELETE role
router.delete('/roles/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid role id' });

    // Prevent deleting if users assigned
    const count = await prisma.user.count({ where: { roleId: id } });
    if (count > 0) {
      return res.status(400).json({ error: `Cannot delete role: ${count} user(s) still assigned.` });
    }

    await prisma.role.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('delete role error', err);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

// DELETE team
router.delete('/teams/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid team id' });

    const count = await prisma.user.count({ where: { teamId: id } });
    if (count > 0) return res.status(400).json({ error: `Cannot delete team: ${count} member(s) still assigned.` });

    await prisma.team.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('delete team error', err);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// DELETE user
router.delete('/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid user id' });

    // Unassign leads (set assignedToId to null)
    await prisma.lead.updateMany({ where: { assignedToId: id }, data: { assignedToId: null } });

    await prisma.user.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('delete user error', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// DELETE ip restriction (handles numeric rows and user-<userId>-<index>)
router.delete('/ip-restrictions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (String(id).startsWith('user-')) {
      const parts = id.split('-');
      if (parts.length < 3) return res.status(400).json({ error: 'Invalid user-ip id format' });
      const userId = parseInt(parts[1], 10);
      const index = parseInt(parts[2], 10);
      if (isNaN(userId) || isNaN(index)) return res.status(400).json({ error: 'Invalid user id or index' });

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ error: 'User not found' });

      const arr = Array.isArray(user.allowedIPs) ? user.allowedIPs.slice() : [];
      if (index < 0 || index >= arr.length) return res.status(400).json({ error: 'Index out of range' });
      arr.splice(index, 1);

      await prisma.user.update({
        where: { id: userId },
        data: { allowedIPs: { set: arr }, ipRestricted: arr.length > 0 ? user.ipRestricted : false }
      });

      return res.json({ success: true, type: 'user', userId, index });
    }

    // numeric restriction
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) return res.status(400).json({ error: 'Invalid restriction id' });

    const restriction = await prisma.iPRestriction.findUnique({ where: { id: numericId } });
    if (!restriction) return res.status(404).json({ error: 'Restriction not found' });

    await prisma.iPRestriction.delete({ where: { id: numericId } });

    // if role-based, clear role.ipRestricted if no active restrictions left
    if (restriction.roleId) {
      const remaining = await prisma.iPRestriction.count({ where: { roleId: restriction.roleId, isActive: true } });
      if (remaining === 0) {
        await prisma.role.update({ where: { id: restriction.roleId }, data: { ipRestricted: false } });
      }
    }

    return res.json({ success: true, type: 'role', id: numericId });
  } catch (err) {
    console.error('delete ip restriction error', err);
    res.status(500).json({ error: 'Failed to delete IP restriction' });
  }
});

module.exports = router;
