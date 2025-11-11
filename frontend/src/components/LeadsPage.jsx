// src/pages/LeadsPage.jsx
import React, { useContext, useEffect, useState, useMemo } from 'react';
import { AuthContext } from './AuthContext';
import { apiFetch } from '../api';
import AddLeadModal from '../components/AddLeadModal';
import LeadDetailModal from '../components/LeadDetailModal';
import { Search, Plus, Filter, Eye } from 'lucide-react';

export default function LeadsPage() {
  const { token, user } = useContext(AuthContext);
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState('');
  const userRole = user?.role ? (typeof user.role === 'string' ? user.role : user.role.name) : null;
  const userTeam = user?.team ? (typeof user.team === 'string' ? user.team : user.team.name) : null;

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
    if (userRole === 'team_lead'||userRole === 'Team Lead') return leads.filter(l => l.teamName === userTeam);
    return leads.filter(l => l.assignedToId === user.id);
  }, [leads, user, userRole, userTeam]);

  const filtered = accessible.filter(l => {
  const s = q.trim().toLowerCase();
  if (!s) return true;

  return [
    l.companyName,
    l.email,
    l.mobile,
    l.assignedToName,
    l.status,
   
  ]
  .filter(Boolean) // remove undefined/null
  .some(field => field.toLowerCase().includes(s));
});


  const handleUpdate = async (id, patch) => {
    try {
      await apiFetch(`/leads/${id}`, token, { method: 'PUT', body: JSON.stringify(patch) });
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

  return (
    <div className="p-4 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-gray-500">{filtered.length} leads</p>
        </div>
        <div className="flex items-center gap-3">
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search..." className="px-3 py-2 border rounded" />
          <button onClick={()=>setShowAdd(true)} className="px-4 py-2 bg-blue-600 text-white rounded flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Lead
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Company</th>
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
                <td className="p-3">{l.email || l.mobile}</td>
                <td className="p-3">{l.status}</td>
                <td className="p-3">{l.assignedToName || 'Unassigned'}</td>
                <td className="p-3">{l.dueDate ? new Date(l.dueDate).toLocaleString() : '—'}</td>
                <td className="p-3">
                  <button onClick={()=>setSelected(l)} className="px-3 py-1 bg-blue-50 text-blue-700 rounded">View</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-500">No leads found</td></tr>}
          </tbody>
        </table>
      </div>

      {showAdd && <AddLeadModal token={token} user={user} onClose={()=>setShowAdd(false)} onSuccess={refresh} />}

      {selected && <LeadDetailModal lead={selected} token={token} user={user} onClose={()=>setSelected(null)} onUpdate={handleUpdate} onRefresh={refresh} users={users} userRole={userRole} userTeam={userTeam} />}
    </div>
  );
}
