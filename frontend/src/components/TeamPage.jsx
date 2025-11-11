import React, { useContext, useEffect, useState, useMemo } from 'react';
import { AuthContext } from './AuthContext';
import { apiFetch } from '../api';
import { User, Mail, Briefcase, Users, Key } from 'lucide-react';

export default function TeamPage() {
  const { token, user } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [roles, setRoles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editTeam, setEditTeam] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [error, setError] = useState('');

  const userRole = typeof user?.role === 'string' ? user?.role : user?.role?.name;
  const userTeam = typeof user?.team === 'string' ? user?.team : user?.team?.name;

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiFetch('/users', token),
      apiFetch('/leads', token),
      apiFetch('/roles', token),
      apiFetch('/teams', token)
    ])
      .then(([usersData, leadsData, rolesData, teamsData]) => {
        setUsers(usersData);
        setLeads(leadsData);
        setRoles(rolesData);
        setTeams(teamsData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const filteredUsers = useMemo(() => {
    return users.filter(u =>
      userRole === 'admin' ||
      (typeof u.team === 'string' ? u.team : u.team?.name) === userTeam
    );
  }, [users, userRole, userTeam]);

  const getUserLeadCount = (userId) => leads.filter(l => l.assignedToId === userId).length;
  const getUserRole = (u) => typeof u.role === 'string' ? u.role : u.role?.name;
  const getUserTeam = (u) => typeof u.team === 'string' ? u.team : u.team?.name;

  const canEditUser = (member) => {
    if (!userRole) return false;
    if (userRole === 'admin') return true;
    if ((userRole === 'team_lead' && getUserTeam(member) === userTeam) || (userRole === 'Team Lead' && getUserTeam(member) === userTeam)) return true;
    return false;
  };

  const handleEdit = (member) => {
    setEditingUser(member);
    setEditName(member.name);
    setEditEmail(member.email);
    setEditRole(getUserRole(member) || '');
    setEditTeam(getUserTeam(member) || '');
    setEditPassword('');
    setError('');
  };

  const saveEdit = async () => {
    if (!editingUser) return;

    // Validate
    if (!editName.trim()) return setError('Name is required');
    if (!editEmail.trim()) return setError('Email is required');
    if (!editRole || !roles.some(r => r.name === editRole)) return setError('Invalid role');
    if (!editTeam || !teams.some(t => t.name === editTeam)) return setError('Invalid team');

    try {
      const body = {
        name: editName,
        email: editEmail,
        roleId: roles.find(r => r.name === editRole)?.id,
        teamId: teams.find(t => t.name === editTeam)?.id
      };

      if (editPassword.trim()) {
        if (editPassword.length < 6) return setError('Password must be at least 6 characters');
        body.password = editPassword;
      }

      const updated = await apiFetch(`/users/${editingUser.id}`, token, {
        method: 'PATCH',
        body
      });

      setUsers(users.map(u => u.id === updated.id ? updated : u));
      setEditingUser(null);
    } catch (err) {
      console.error(err);
      setError('Failed to save user');
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
        <p className="text-gray-600 mt-1">{filteredUsers.length} team members</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map((member) => (
          <div key={member.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {member.name ? member.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 text-lg truncate">{member.name}</h3>
                <p className="text-sm text-gray-600 mt-0.5">{getUserRole(member)}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-700 truncate">{member.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-700">{getUserTeam(member) || 'No team'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Briefcase className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-700">{getUserLeadCount(member.id)} active leads</span>
              </div>
            </div>

            {canEditUser(member) && (
              <button
                className="mt-4 w-full px-4 py-2 text-sm bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100"
                onClick={() => handleEdit(member)}
              >
                Edit
              </button>
            )}
          </div>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No team members found</h3>
          <p className="text-gray-600">There are no team members to display.</p>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Edit User</h2>
            {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
            <div className="space-y-3">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Name"
                className="w-full px-4 py-2 border rounded-lg"
              />
              <input
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="Email"
                className="w-full px-4 py-2 border rounded-lg"
              />
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="">Select role</option>
                {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
              <select
                value={editTeam}
                onChange={(e) => setEditTeam(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="">Select team</option>
                {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="New password (optional)"
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-gray-200 rounded-lg"
                onClick={() => setEditingUser(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                onClick={saveEdit}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
