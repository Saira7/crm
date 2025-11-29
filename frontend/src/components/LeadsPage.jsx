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

  const [activeTab, setActiveTab] = useState('lead'); // 'lead' | 'callback' | 'sale' | 'transfer'
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
  const userId = user?.id;

  const TABS = [
    { key: 'lead', label: 'Leads' },
    { key: 'callback', label: 'Call Backs' },
    { key: 'sale', label: 'Sales' },
    { key: 'transfer', label: 'Transfers' },
  ];

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

  // Which leads this user can see (current or previously assigned)
  const accessible = useMemo(() => {
    if (!userId) return [];
    return leads.filter((l) => {
      if (l.assignedToId === userId) return true;
      const prev = Array.isArray(l.previousAssignedToIds)
        ? l.previousAssignedToIds
        : [];
      return prev.includes(userId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, normRole, userId, userTeam]);

  // Filter by tab (status)
  const byStatus = useMemo(
    () => accessible.filter((l) => l.status === activeTab),
    [accessible, activeTab]
  );

  // Split into current vs previous
  const myActive = useMemo(
    () => byStatus.filter((l) => l.assignedToId === userId),
    [byStatus, userId]
  );

  const myPrevious = useMemo(
    () =>
      byStatus.filter((l) => {
        if (l.assignedToId === userId) return false;
        const prev = Array.isArray(l.previousAssignedToIds)
          ? l.previousAssignedToIds
          : [];
        return prev.includes(userId);
      }),
    [byStatus, userId]
  );

  const searchFilter = (list) => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((l) =>
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
  };

  const filteredActive = useMemo(
    () => searchFilter(myActive),
    [myActive, q]
  );
  const filteredPrevious = useMemo(
    () => searchFilter(myPrevious),
    [myPrevious, q]
  );

    // assignment options for dropdown (used only in active section)
  const assignableUsers = useMemo(() => {
    if (!Array.isArray(users) || !user) return [];

    const getUserTeamName = (u) =>
      u?.team
        ? (typeof u.team === 'string' ? u.team : u.team.name)
        : null;

    const getUserRoleName = (u) =>
      u?.role
        ? (typeof u.role === 'string' ? u.role : u.role.name)
        : null;

    const myTeamName = userTeam;

    // teams THIS user leads (from junction table)
    const leadTeamNames = Array.isArray(user?.leadTeams)
      ? user.leadTeams
          .map((lt) =>
            lt.team
              ? (typeof lt.team === 'string' ? lt.team : lt.team.name)
              : null
          )
          .filter(Boolean)
      : [];

    // union of primary team + all led teams
    const allowedTeamNames = Array.from(
      new Set([myTeamName, ...leadTeamNames].filter(Boolean))
    );

    // Admin / Manager → can assign to any user
    if (normRole === 'admin' || normRole === 'manager') {
      return users;
    }

    // Team Lead → can assign to users in ANY team they lead
    if (
      normRole === 'team_lead' ||
      normRole === 'team lead' ||
      normRole === 'team-lead'
    ) {
      if (!allowedTeamNames.length) return [];
      return users.filter((u) => {
        const t = getUserTeamName(u);
        return t && allowedTeamNames.includes(t);
      });
    }

    // Regular agent:
    //  - can assign to themselves
    //  - can assign to team leads that:
    //      * have primaryTeam === myTeamName
    //      * OR lead myTeamName via leadTeams
    if (!myTeamName) return [user].filter(Boolean);

    return users.filter((u) => {
      // always allow self
      if (u.id === user.id) return true;

      const roleName = (getUserRoleName(u) || '').toLowerCase();
      const isTL =
        roleName === 'team_lead' ||
        roleName === 'team lead' ||
        roleName === 'team-lead';

      if (!isTL) return false;

      const primaryTeamOfTL = getUserTeamName(u);

      const leadsMyTeamViaJunction = Array.isArray(u.leadTeams)
        ? u.leadTeams.some((lt) => {
            if (!lt.team) return false;
            const tName =
              typeof lt.team === 'string'
                ? lt.team
                : lt.team.name;
            return tName === myTeamName;
          })
        : false;

      return primaryTeamOfTL === myTeamName || leadsMyTeamViaJunction;
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

  const currentTab = TABS.find((t) => t.key === activeTab);
  const totalFiltered = filteredActive.length + filteredPrevious.length;

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {currentTab?.label || 'Leads'}
            </h1>
            <p className="text-sm text-gray-500">
              {totalFiltered} records (current + previously assigned)
            </p>
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
              Add {currentTab?.label?.slice(0, -1) || 'Lead'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={
                'px-3 py-1.5 text-xs font-medium rounded-full border ' +
                (activeTab === tab.key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50')
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section: Currently Assigned */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">
            Currently Assigned {currentTab?.label} ({filteredActive.length})
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-semibold text-gray-600">
            <tr>
              <th className="p-3 text-left">Company Name</th>
              <th className="p-3 text-left">Contact</th>
              <th className="p-3 text-left">Comment</th>
              <th className="p-3 text-left">Due</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredActive.map((l) => (
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
                  <div className="flex flex-col gap-2 min-w-[230px]">
                    {/* Assigned To dropdown */}
                    <select
                      className="flex-1 px-2 py-1 border rounded-lg text-xs"
                      value={l.assignedToId || ''}
                      onChange={(e) => handleAssignChange(l.id, e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {assignableUsers.map((u) => {
                        const roleLabel =
                          typeof u.role === 'string'
                            ? u.role
                            : u.role?.name || 'user';
                        return (
                          <option key={u.id} value={u.id}>
                            {u.name} ({roleLabel})
                          </option>
                        );
                      })}
                    </select>

                    {/* View / Delete buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelected(l)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs"
                      >
                        <Eye className="w-3 h-3" />
                        View
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(l.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-xs"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {filteredActive.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">
                  No currently assigned records for this status.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Section: Previously Assigned (READ-ONLY except View) */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">
            Previously Assigned {currentTab?.label} ({filteredPrevious.length})
          </h2>
          <p className="text-xs text-gray-500">
            Leads you handled earlier but are now with someone else.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-semibold text-gray-600">
            <tr>
              <th className="p-3 text-left">Company Name</th>
              <th className="p-3 text-left">Contact</th>
              <th className="p-3 text-left">Currently Assigned</th>
              <th className="p-3 text-left">Comment</th>
              <th className="p-3 text-left">Due</th>
            </tr>
          </thead>
          <tbody>
            {filteredPrevious.map((l) => (
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
                <td className="p-3 align-top">
                  {l.assignedToName ? (
                    <span className="text-gray-800 text-sm">
                      {l.assignedToName}
                    </span>
                  ) : (
                    <span className="text-red-600 text-sm font-medium">
                      Unassigned
                    </span>
                  )}
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
                
              </tr>
            ))}
            {filteredPrevious.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500">
                  No previously assigned records for this status.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <AddLeadModal
          token={token}
          user={user}
          users={users}
          userRole={userRole}
          initialStatus={activeTab}
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
          userRole={userRole}
          userTeam={userTeam}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          onRefresh={refresh}
        />
      )}
    </div>
  );
}
