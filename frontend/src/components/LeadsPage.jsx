// src/pages/LeadsPage.jsx
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './AuthContext';
import { apiFetch } from '../api';
import AddLeadModal from '../components/AddLeadModal';
import LeadDetailModal from '../components/LeadDetailModal';
import { Search, Plus, Eye, Trash2 } from 'lucide-react';

export default function LeadsPage() {
  const { token, user } = useContext(AuthContext);
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState('');

  const userRole = user?.role
    ? (typeof user.role === 'string' ? user.role : user.role.name)
    : null;
  const userTeam = user?.team
    ? (typeof user.team === 'string' ? user.team : user.team.name)
    : null;

  const normRole = (userRole || '').toString().toLowerCase();

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [leadsData, usersData] = await Promise.all([
        apiFetch('/leads', token),
        apiFetch('/users', token),
      ]);
      setLeads(leadsData || []);
      setUsers(usersData || []);
    } catch (err) {
      console.error('Failed to load leads/users', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const refresh = async () => {
    await load();
  };

  // Which leads are visible to this user
  const accessible = useMemo(() => {
    if (!user) return [];
    if (normRole === 'admin') return leads;
    if (normRole === 'team_lead' || normRole === 'team lead' || normRole === 'team-lead') {
      return leads.filter((l) => l.teamName === userTeam);
    }
    return leads.filter((l) => l.assignedToId === user.id);
  }, [leads, user, normRole, userTeam]);

  // Global search on visible leads
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return accessible;
    return accessible.filter((l) =>
      [
        l.companyName,
        l.mobile,
        l.email,
        l.leadComment,
        l.callbackComment,
        l.saleComment,
      ]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(s))
    );
  }, [accessible, q]);

  // Who can manage (delete / broad assignment)
  const canManageLeads = ['admin', 'manager', 'team_lead', 'team lead', 'team-lead'].includes(
    normRole
  );

  // Options for "Assigned to" dropdown
  const assignableUsers = useMemo(() => {
    if (!Array.isArray(users) || !user) return [];
    if (normRole === 'admin' || normRole === 'manager') {
      return users;
    }
    if (normRole === 'team_lead' || normRole === 'team lead' || normRole === 'team-lead') {
      // team leads can assign within their team
      return users.filter((u) => {
        const t = u?.team ? (typeof u.team === 'string' ? u.team : u.team.name) : null;
        return t && t === userTeam;
      });
    }
    // regular agent: can assign to themselves + their team lead(s)
    return users.filter((u) => {
      const t = u?.team ? (typeof u.team === 'string' ? u.team : u.team.name) : null;
      const r = u?.role ? (typeof u.role === 'string' ? u.role : u.role.name) : null;
      const nr = (r || '').toString().toLowerCase();
      if (u.id === user.id) return true;
      if ((nr === 'team_lead' || nr === 'team lead' || nr === 'team-lead') && t === userTeam) {
        return true;
      }
      return false;
    });
  }, [users, user, normRole, userTeam]);

  const getComment = (lead) =>
    lead.leadComment || lead.callbackComment || lead.saleComment || '';

  const handleUpdate = async (id, patch) => {
    try {
      await apiFetch(`/leads/${id}`, token, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
      await refresh();
      if (selected?.id === id) {
        setSelected((prev) => (prev ? { ...prev, ...patch } : prev));
      }
    } catch (err) {
      console.error('Update failed', err);
      alert(err.message || 'Update failed');
    }
  };

  const handleDelete = async (id) => {
    if (!canManageLeads) return;
    const ok = window.confirm('Are you sure you want to delete this record?');
    if (!ok) return;
    try {
      await apiFetch(`/leads/${id}`, token, {
        method: 'DELETE',
      });
      setLeads((prev) => prev.filter((l) => l.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (err) {
      console.error('Delete failed', err);
      alert(err.message || 'Failed to delete');
    }
  };

  const handleAssignChange = async (leadId, assignedToIdStr) => {
    const assignedToId = assignedToIdStr ? parseInt(assignedToIdStr, 10) : null;
    try {
      await apiFetch(`/leads/${leadId}`, token, {
        method: 'PUT',
        body: JSON.stringify({ assignedToId }),
      });
      await refresh();
    } catch (err) {
      console.error('Assign failed', err);
      alert(err.message || 'Failed to assign');
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Leads / Call Backs / Sales / Transfers
            </h1>
            <p className="text-sm text-gray-500">{filtered.length} records</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, phone, email, comment…"
                className="pl-9 pr-3 py-2 border rounded-lg text-sm"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Lead
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-semibold text-gray-600">
            <tr>
              <th className="p-3 text-left">Customer Name</th>
              <th className="p-3 text-left">Contact</th>
              <th className="p-3 text-left">Comment</th>
              <th className="p-3 text-left">Due</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} className="border-t hover:bg-gray-50">
                <td className="p-3 align-top">
                  <div className="font-medium text-gray-900">{l.companyName}</div>
                  {l.email && (
                    <div className="text-xs text-gray-500 mt-0.5">{l.email}</div>
                  )}
                </td>
                <td className="p-3 align-top">
                  <div className="text-gray-800">{l.mobile}</div>
                </td>
                <td className="p-3 align-top max-w-xs">
                  <div className="text-gray-700 line-clamp-2">
                    {getComment(l) || (
                      <span className="text-gray-400 italic">No comment</span>
                    )}
                  </div>
                </td>
                <td className="p-3 align-top">
                  {l.dueDate ? (
                    <span>{new Date(l.dueDate).toLocaleString()}</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="p-3 align-top">
                  <div className="flex flex-col gap-2 min-w-[220px]">
                    {/* Assignment dropdown */}
                    <div className="flex items-center gap-2">
                      <select
                        className="flex-1 px-2 py-1 border rounded-lg text-xs"
                        value={l.assignedToId || ''}
                        onChange={(e) => handleAssignChange(l.id, e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {assignableUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}{' '}
                            {(
                              typeof u.role === 'string'
                                ? u.role
                                : u.role?.name
                            ) || 'user'}
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* View / Delete buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelected(l)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs"
                      >
                        <Eye className="w-3 h-3" />
                        View
                      </button>
                      {canManageLeads && (
                        <button
                          onClick={() => handleDelete(l.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-xs"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">
                  No records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Lead Modal */}
      {showAdd && (
        <AddLeadModal
          token={token}
          user={user}
          users={users}
          userRole={userRole}
          onClose={() => setShowAdd(false)}
          onSuccess={refresh}
        />
      )}

      {/* Detail Modal */}
      {selected && (
        <LeadDetailModal
          lead={selected}
          token={token}
          user={user}
          users={users}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          onRefresh={refresh}
        />
      )}
    </div>
  );
}
