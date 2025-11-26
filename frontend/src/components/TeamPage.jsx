// src/components/TeamPage.jsx
import React, { useContext, useEffect, useState, useMemo } from 'react';
import { AuthContext } from './AuthContext';
import { apiFetch } from '../api';
import { User, Mail, Briefcase, Users, Key, Plus, Trash2 } from 'lucide-react';

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

  // Add-member modal state
  const [adding, setAdding] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState('');
  const [addTeam, setAddTeam] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addError, setAddError] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  const userRole = typeof user?.role === 'string' ? user?.role : user?.role?.name;
  const userTeam = typeof user?.team === 'string' ? user?.team : user?.team?.name;
  const userId = user?.id;

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
      (userRole && userRole.toString().toLowerCase() === 'admin') ||
      (typeof u.team === 'string' ? u.team : u.team?.name) === userTeam
    );
  }, [users, userRole, userTeam]);

  const getUserLeadCount = (uid) => leads.filter(l => l.assignedToId === uid).length;
  const getUserRole = (u) => typeof u.role === 'string' ? u.role : u.role?.name;
  const getUserTeam = (u) => typeof u.team === 'string' ? u.team : u.team?.name;

  /**
   * canEditUser:
   * - admin can edit anyone
   * - team_lead can edit members in same team
   * - nobody can edit themselves via this UI (safety)
   */
  const canEditUser = (member) => {
    if (!userRole) return false;
    if (member?.id === userId) return false;

    const roleNormalized = (userRole || '').toString().toLowerCase();
    if (roleNormalized === 'admin') return true;

    if (roleNormalized === 'team_lead' || roleNormalized === 'team lead' || roleNormalized === 'team-lead') {
      return getUserTeam(member) === userTeam;
    }

    return false;
  };

  /**
   * canDeleteUser:
   * - same as canEditUser (admin or same-team team_lead)
   * - additionally: don't allow deleting yourself
   */
  const canDeleteUser = (member) => canEditUser(member);

  const handleEdit = (member) => {
    setEditingUser(member);
    setEditName(member.name || '');
    setEditEmail(member.email || '');
    setEditRole(getUserRole(member) || '');
    setEditTeam(getUserTeam(member) || '');
    setEditPassword('');
    setError('');
  };

  const saveEdit = async () => {
    if (!editingUser) return;

    if (!editName.trim()) return setError('Name is required');
    if (!editEmail.trim()) return setError('Email is required');

    const normalizedCurrentRole = (userRole || '').toString().toLowerCase();
    const isAdmin = normalizedCurrentRole === 'admin';
    const isTeamLead = normalizedCurrentRole === 'team_lead' || normalizedCurrentRole === 'team lead' || normalizedCurrentRole === 'team-lead';

    // Basic checks for role/team if provided
    if ((isAdmin || isTeamLead) && editRole) {
      if (!roles.some(r => r.name === editRole)) {
        return setError('Invalid role selected');
      }
    }
    if ((isAdmin || isTeamLead) && editTeam) {
      if (!teams.some(t => t.name === editTeam)) {
        return setError('Invalid team selected');
      }
      
    }

    if (editPassword && editPassword.trim().length > 0 && editPassword.length < 6) {
      return setError('Password must be at least 6 characters');
    }

    try {
      const body = {
        name: editName,
        email: editEmail
      };

      if (editPassword && editPassword.trim().length > 0) {
        body.password = editPassword;
      }

      if (isAdmin || isTeamLead) {
        const foundRole = roles.find(r => r.name === editRole);
        const foundTeam = teams.find(t => t.name === editTeam);

        // prevent team_lead from promoting to admin
        if (isTeamLead && foundRole && foundRole.name.toLowerCase() === 'admin') {
          return setError('Team Leads cannot assign the admin role');
        }

        if (foundRole) body.roleId = foundRole.id;
        if (foundTeam) body.teamId = foundTeam.id;
      }

      const updated = await apiFetch(`/users/${editingUser.id}`, token, {
        method: 'PATCH',
        body
      });

      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
      setEditingUser(null);
    } catch (err) {
      console.error('saveEdit error', err);
      setError(err?.message || 'Failed to save user');
    }
  };

  const handleDelete = async (member) => {
    if (!canDeleteUser(member)) return;
    const confirmed = window.confirm(`Are you sure you want to delete ${member.name || member.email}?`);
    if (!confirmed) return;

    try {
      await apiFetch(`/users/${member.id}`, token, {
        method: 'DELETE'
      });
      setUsers(prev => prev.filter(u => u.id !== member.id));
    } catch (err) {
      console.error('delete user error', err);
      alert(err?.message || 'Failed to delete user');
    }
  };

  const openAddModal = () => {
    const defaultRole = roles.find(r => r.name.toLowerCase().includes('sales'))?.name || roles[0]?.name || '';
    setAdding(true);
    setAddName('');
    setAddEmail('');
    setAddPassword('');
    setAddRole(defaultRole);
    setAddTeam(userRole?.toLowerCase() === 'admin' ? '' : userTeam || '');
    setAddError('');
  };

  const saveAdd = async () => {
    if (!addName.trim()) return setAddError('Name is required');
    if (!addEmail.trim()) return setAddError('Email is required');
    if (!addPassword.trim() || addPassword.length < 6) {
      return setAddError('Password must be at least 6 characters');
    }

    const normalizedCurrentRole = (userRole || '').toString().toLowerCase();
    const isAdmin = normalizedCurrentRole === 'admin';
    const isTeamLead = normalizedCurrentRole === 'team_lead' || normalizedCurrentRole === 'team lead' || normalizedCurrentRole === 'team-lead';

    if (!isAdmin && !isTeamLead) {
      return setAddError('Only Admins and Team Leads can add members');
    }

    const chosenRole = roles.find(r => r.name === addRole);
    if (!chosenRole) {
      return setAddError('Invalid role selected');
    }

    if (isTeamLead && chosenRole.name.toLowerCase() === 'admin') {
      return setAddError('Team Leads cannot create admin users');
    }

    let chosenTeam = teams.find(t => t.name === addTeam);

    if (isTeamLead) {
      // force team to team lead's own team
      chosenTeam = teams.find(t => t.name === userTeam);
      if (!chosenTeam) {
        return setAddError('Your team could not be found; contact an admin');
      }
    } else if (isAdmin && !chosenTeam) {
      return setAddError('Please choose a valid team');
    }

    const body = {
      name: addName,
      email: addEmail,
      password: addPassword,
      roleId: chosenRole.id,
      teamId: chosenTeam ? chosenTeam.id : null
    };

    try {
      setAddSaving(true);
      const created = await apiFetch('/users', token, {
        method: 'POST',
        body
      });
      setUsers(prev => [...prev, created]);
      setAdding(false);
    } catch (err) {
      console.error('saveAdd error', err);
      setAddError(err?.message || 'Failed to create user');
    } finally {
      setAddSaving(false);
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

  const canAddMembers = (() => {
    if (!userRole) return false;
    const rn = userRole.toString().toLowerCase();
    return rn === 'admin' || rn === 'team_lead' || rn === 'team lead' || rn === 'team-lead';
  })();

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
          <p className="text-gray-600 mt-1">{filteredUsers.length} team members</p>
        </div>
        {canAddMembers && (
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Member
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map((member) => (
          <div
            key={member.id}
            className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow flex flex-col justify-between"
          >
            <div>
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
            </div>

            <div className="mt-4 flex gap-2">
              {canEditUser(member) && (
                <button
                  className="flex-1 px-3 py-2 text-sm bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100"
                  onClick={() => handleEdit(member)}
                >
                  Edit
                </button>
              )}
              {canDeleteUser(member) && (
                <button
                  className="px-3 py-2 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 flex items-center gap-1"
                  onClick={() => handleDelete(member)}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
            </div>
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

      {/* Edit User Modal */}
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

              {/* Role & Team: admin and team_lead can edit */}
              {(userRole || '').toString().toLowerCase() === 'admin' ||
               (userRole || '').toString().toLowerCase().startsWith('team_lead') ||
               (userRole || '').toString().toLowerCase() === 'team lead' ||
               (userRole || '').toString().toLowerCase() === 'team-lead' ? (
                <>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg"
                  >
                    <option value="">Select role</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.name}>{r.name}</option>
                    ))}
                  </select>

                  <select
                    value={editTeam}
                    onChange={(e) => setEditTeam(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg"
                    //disabled={((userRole || '').toString().toLowerCase() !== 'admin')}
                  >
                    <option value="">Select team</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </>
              ) : null}

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

      {/* Add User Modal */}
      {adding && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Add Team Member</h2>
            {addError && <p className="text-red-600 text-sm mb-2">{addError}</p>}
            <div className="space-y-3">
              <input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Name"
                className="w-full px-4 py-2 border rounded-lg"
              />
              <input
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="Email"
                className="w-full px-4 py-2 border rounded-lg"
              />
              <input
                type="password"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-4 py-2 border rounded-lg"
              />

              <select
                value={addRole}
                onChange={(e) => setAddRole(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="">Select role</option>
                {roles.map(r => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>

              <select
                value={addTeam}
                onChange={(e) => setAddTeam(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
                disabled={(userRole || '').toString().toLowerCase() !== 'admin'}
              >
                <option value="">Select team</option>
                {teams.map(t => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-gray-200 rounded-lg"
                onClick={() => setAdding(false)}
                disabled={addSaving}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                onClick={saveAdd}
                disabled={addSaving}
              >
                {addSaving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
