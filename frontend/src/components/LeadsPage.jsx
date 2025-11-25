// src/pages/LeadsPage.jsx
import React, { useContext, useEffect, useState, useMemo } from 'react';
import { AuthContext } from './AuthContext';
import { apiFetch } from '../api';
import AddLeadModal from '../components/AddLeadModal';
import LeadDetailModal from '../components/LeadDetailModal';
import { Plus } from 'lucide-react';

export default function LeadsPage() {
  const { token, user } = useContext(AuthContext);
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState('');

  const [activeTab, setActiveTab] = useState('lead'); // 'lead' | 'callback' | 'sale' | 'transfer'

  const TABS = [
    { key: 'lead', label: 'Leads' },
    { key: 'callback', label: 'Call Backs' },
    { key: 'sale', label: 'Sales' },
    { key: 'transfer', label: 'Transfers' },
  ];

  const userRole = user?.role
    ? (typeof user.role === 'string' ? user.role : user.role.name)
    : null;

  const userTeam = user?.team
    ? (typeof user.team === 'string' ? user.team : user.team.name)
    : null;

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [leadsData, usersData] = await Promise.all([
        apiFetch('/leads', token),
        apiFetch('/users', token)
      ]);
      setLeads(leadsData || []);
      setUsers(usersData || []);
    } catch (err) {
      console.error('Failed to load leads/users', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const refresh = async () => { await load(); };

  const accessible = useMemo(() => {
    if (!user) return [];
    if (userRole === 'admin') return leads;
    if (userRole === 'team_lead' || userRole === 'Team Lead') {
      return leads.filter(l => l.teamName === userTeam);
    }
    return leads.filter(l => l.assignedToId === user.id);
  }, [leads, user, userRole, userTeam]);

  // Filter by status based on active tab
  const statusFiltered = useMemo(() => {
    return accessible.filter(l => {
      if (!activeTab) return true;

      if (activeTab === 'transfer') {
        return l.status === 'transfer';
      }

      // For lead / callback / sale
      return l.status === activeTab;
    });
  }, [accessible, activeTab]);

  // Search within the status-filtered leads
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return statusFiltered;

    return statusFiltered.filter(l =>
      [
        l.companyName,
        l.email,
        l.mobile,
        l.assignedToName,
        l.status,
      ]
        .filter(Boolean)
        .some(field => field.toLowerCase().includes(s))
    );
  }, [statusFiltered, q]);

  const handleUpdate = async (id, patch) => {
    try {
      await apiFetch(`/leads/${id}`, token, {
        method: 'PUT',
        body: JSON.stringify(patch)
      });
      await refresh();
      if (selected?.id === id) {
        setSelected(prev => ({ ...prev, ...patch }));
      }
    } catch (err) {
      console.error('Update failed', err);
      alert(err.message || 'Update failed');
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  const currentTabLabel =
    TABS.find(t => t.key === activeTab)?.label || 'Leads';

  const currentTabCountLabel =
    activeTab === 'sale'
      ? 'sales'
      : activeTab === 'callback'
      ? 'call backs'
      : activeTab === 'transfer'
      ? 'transfers'
      : 'leads';

  const addButtonLabel =
    activeTab === 'sale'
      ? 'Add Sale'
      : activeTab === 'callback'
      ? 'Add Call Back'
      : activeTab === 'transfer'
      ? 'Add Transfer'
      : 'Add Lead';

  return (
    <div className="p-4 lg:p-8">
      {/* Header + Search + Add button + Tabs */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{currentTabLabel}</h1>
            <p className="text-sm text-gray-500">
              {filtered.length} {currentTabCountLabel}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search..."
              className="px-3 py-2 border rounded"
            />
            <button
              onClick={() => setShowAdd(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> {addButtonLabel}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {TABS.map(tab => {
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={
                  'px-3 py-1.5 text-sm rounded-full border ' +
                  (isActive
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50')
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Customer Name</th>
              <th className="p-3 text-left">Contact</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Assigned</th>
              <th className="p-3 text-left">Due</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => (
              <tr key={l.id} className="border-t">
                <td className="p-3">{l.companyName}</td>
                <td className="p-3">{l.mobile}</td>
                <td className="p-3">{l.status}</td>
                <td className="p-3">{l.assignedToName || 'Unassigned'}</td>
                <td className="p-3">
                  {l.dueDate ? new Date(l.dueDate).toLocaleString() : '—'}
                </td>
                <td className="p-3">
                  <button
                    onClick={() => setSelected(l)}
                    className="px-3 py-1 bg-blue-50 text-blue-700 rounded"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500">
                  No {currentTabCountLabel} found
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
