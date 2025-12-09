// src/components/TeamLeadOverview.jsx
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './AuthContext';
import { apiFetch } from '../api';
import LeadDetailModal from './LeadDetailModal';
import { Search, Eye } from 'lucide-react';

const TABS = [
  { key: 'lead', label: 'Leads' },
  { key: 'callback', label: 'Call Backs' },
  { key: 'sale', label: 'Sales' },
  { key: 'transfer', label: 'Transfers' },
  { key: 'unassigned', label: 'Unassigned' },
];

export default function TeamLeadOverview() {
  const { token, user } = useContext(AuthContext);
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('lead');
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('all');

  // NEW: date range filters
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');

  const userRole = user?.role
    ? typeof user.role === 'string'
      ? user.role
      : user.role.name
    : null;
  const normRole = (userRole || '').toString().toLowerCase();

  const userTeam = user?.team
    ? typeof user.team === 'string'
      ? user.team
      : user.team.name
    : null;
  const userTeamId = user?.teamId || user?.team?.id || null;

  const isTeamLeadRole =
    normRole === 'team_lead' ||
    normRole === 'team lead' ||
    normRole === 'team-lead';

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      try {
        const [leadsData, usersData, teamsData] = await Promise.all([
          apiFetch('/leads', token),
          apiFetch('/users', token),
          apiFetch('/teams', token),
        ]);
        setLeads(leadsData || []);
        setUsers(usersData || []);
        setTeams(teamsData || []);
      } catch (err) {
        console.error('Failed to load team overview data', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const canView =
    normRole === 'admin' ||
    normRole === 'team_lead' ||
    normRole === 'team lead' ||
    normRole === 'team-lead';

  const userMap = useMemo(() => {
    const m = new Map();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  const getComment = (lead) =>
    lead.leadComment || lead.callbackComment || lead.saleComment || '';

  const getLeadTeamName = (lead) => {
    if (lead.teamName) return lead.teamName;
    if (lead.assignedToId) {
      const u = userMap.get(lead.assignedToId);
      if (!u) return null;
      const t = u.team
        ? typeof u.team === 'string'
          ? u.team
          : u.team.name
        : null;
      return t || null;
    }
    return null;
  };

  // Teams this user leads (TeamLeadAssignment + primary team)
  const leadTeamIds = useMemo(() => {
    if (!isTeamLeadRole) return [];

    const idsFromAssignments = teams
      .filter(
        (t) =>
          Array.isArray(t.leads) &&
          t.leads.some((lt) => lt.userId === user.id)
      )
      .map((t) => t.id);

    const fromPrimary = userTeamId ? [userTeamId] : [];
    return Array.from(new Set([...idsFromAssignments, ...fromPrimary]));
  }, [teams, isTeamLeadRole, user?.id, userTeamId]);

  const leadTeamNames = useMemo(
    () =>
      teams
        .filter((t) => leadTeamIds.includes(t.id))
        .map((t) => t.name),
    [teams, leadTeamIds]
  );

  // Team members
  const teamMembers = useMemo(() => {
    if (normRole === 'admin') {
      if (selectedTeam === 'all') {
        return users.filter((u) => u.id !== user.id);
      }
      return users.filter((u) => {
        if (u.id === user.id) return false;
        const t = u.team
          ? typeof u.team === 'string'
            ? u.team
            : u.team.name
          : null;
        return t === selectedTeam;
      });
    }

    if (isTeamLeadRole) {
      if (!leadTeamIds.length) return [];
      return users.filter((u) => {
        if (u.id === user.id) return false;
        const tid = u.teamId || (u.team && u.team.id) || null;
        return tid && leadTeamIds.includes(tid);
      });
    }

    // fallback for normal users
    if (!userTeamId && !userTeam) return [];
    return users.filter((u) => {
      if (u.id === user.id) return false;
      const tid = u.teamId || (u.team && u.team.id) || null;
      const tname = u.team
        ? typeof u.team === 'string'
          ? u.team
          : u.team.name
        : null;
      return tid === userTeamId || (userTeam && tname === userTeam);
    });
  }, [
    users,
    user.id,
    normRole,
    selectedTeam,
    userTeam,
    userTeamId,
    isTeamLeadRole,
    leadTeamIds,
  ]);

  const teamMemberIds = useMemo(
    () => new Set(teamMembers.map((u) => u.id)),
    [teamMembers]
  );

  const unassignedLeads = useMemo(
    () =>
      leads.filter((l) => {
        if (l.assignedToId) return false;

        if (normRole === 'admin') {
          if (selectedTeam === 'all') return true;
          return getLeadTeamName(l) === selectedTeam;
        }

        if (isTeamLeadRole) {
          if (!leadTeamNames.length) return false;
          const lt = getLeadTeamName(l);
          return lt && leadTeamNames.includes(lt);
        }

        // normal user
        return getLeadTeamName(l) === userTeam;
      }),
    [
      leads,
      normRole,
      isTeamLeadRole,
      leadTeamNames,
      userTeam,
      selectedTeam,
      userMap,
    ]
  );

  const rows = useMemo(() => {
    let base = [];

    if (activeTab === 'unassigned') {
      base = unassignedLeads;
    } else {
      base = leads.filter((l) => {
        if (l.status !== activeTab) return false;

        const isTeammateAssigned =
          l.assignedToId &&
          l.assignedToId !== user.id &&
          teamMemberIds.has(l.assignedToId);

        const isUnassigned =
          !l.assignedToId &&
          (normRole === 'admin'
            ? selectedTeam === 'all'
              ? true
              : getLeadTeamName(l) === selectedTeam
            : isTeamLeadRole
            ? leadTeamNames.length > 0 &&
              (() => {
                const lt = getLeadTeamName(l);
                return lt && leadTeamNames.includes(lt);
              })()
            : getLeadTeamName(l) === userTeam);

        return isTeammateAssigned || isUnassigned;
      });
    }

    // Text search filter
    const s = q.trim().toLowerCase();
    if (s) {
      base = base.filter((l) =>
        [
          l.companyName,
          l.mobile,
          l.email,
          getComment(l),
          l.status,
          l.assignedToName,
        ]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(s))
      );
    }

    // NEW: date range filter on createdAt
    if (createdFrom || createdTo) {
      const fromDate = createdFrom
        ? new Date(`${createdFrom}T00:00:00`)
        : null;
      const toDate = createdTo
        ? new Date(`${createdTo}T23:59:59.999`)
        : null;

      base = base.filter((l) => {
        if (!l.createdAt) return false;
        const created = new Date(l.createdAt);
        if (Number.isNaN(created.getTime())) return false;

        if (fromDate && created < fromDate) return false;
        if (toDate && created > toDate) return false;

        return true;
      });
    }

    return base;
  }, [
    activeTab,
    leads,
    unassignedLeads,
    teamMemberIds,
    user.id,
    normRole,
    userTeam,
    q,
    selectedTeam,
    isTeamLeadRole,
    leadTeamNames,
    createdFrom,
    createdTo,
  ]);

  if (!canView) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Team Overview
        </h1>
        <p className="text-gray-600">
          Only Team Leads and Admins can view this page.
        </p>
      </div>
    );
  }

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

  const summaryLabel =
    normRole === 'admin'
      ? selectedTeam === 'all'
        ? 'all teams'
        : selectedTeam
      : isTeamLeadRole && leadTeamNames.length > 1
      ? 'your teams'
      : userTeam || 'your team';

  const getLeadCountForMember = (memberId) => {
    return leads.filter((l) => {
      if (l.assignedToId !== memberId) return false;

      if (normRole === 'admin' && selectedTeam !== 'all') {
        return getLeadTeamName(l) === selectedTeam;
      }

      if (isTeamLeadRole) {
        if (!leadTeamNames.length) return false;
        const lt = getLeadTeamName(l);
        return lt && leadTeamNames.includes(lt);
      }

      return getLeadTeamName(l) === userTeam;
    }).length;
  };

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Team Overview – {currentTab?.label}
            </h1>
            <p className="text-sm text-gray-500">
              {normRole === 'admin'
                ? 'Showing items across all teams, filter by team or date range below if needed.'
                : 'Showing items assigned to your team members and unassigned items for the teams you lead.'}
            </p>
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            {normRole === 'admin' && (
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm bg-white"
              >
                <option value="all">All Teams</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}

            {/* Date range filter */}
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="date"
                value={createdFrom}
                onChange={(e) => setCreatedFrom(e.target.value)}
                className="px-3 py-2 border rounded-lg text-xs lg:text-sm"
                title="Created from"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date"
                value={createdTo}
                onChange={(e) => setCreatedTo(e.target.value)}
                className="px-3 py-2 border rounded-lg text-xs lg:text-sm"
                title="Created to"
              />
            </div>

            <div className="relative">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, phone, email, comment…"
                className="pl-9 pr-3 py-2 border rounded-lg text-sm"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
            </div>
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

      {/* Team members summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-2">
          Team members in {summaryLabel}
        </h2>
        {teamMembers.length === 0 ? (
          <p className="text-sm text-gray-500">
            No team members found for this view.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {teamMembers.map((m) => {
              const roleLabel =
                typeof m.role === 'string' ? m.role : m.role?.name || 'user';
              const countForMember = getLeadCountForMember(m.id);

              return (
                <div
                  key={m.id}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-800 bg-gray-50"
                >
                  <div className="font-medium">{m.name}</div>
                  <div className="text-gray-500">
                    {roleLabel} • {countForMember} item
                    {countForMember !== 1 ? 's' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-semibold text-gray-600">
            <tr>
              <th className="p-3 text-left">Customer Name</th>
              <th className="p-3 text-left">Contact</th>
              <th className="p-3 text-left">Assigned To</th>
              <th className="p-3 text-left">Comment</th>
              <th className="p-3 text-left">Due</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const assignedUser = l.assignedToId
                ? userMap.get(l.assignedToId)
                : null;
              const assignedRole = assignedUser
                ? (typeof assignedUser.role === 'string'
                    ? assignedUser.role
                    : assignedUser.role?.name) || 'user'
                : null;

              return (
                <tr key={l.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 align-top">
                    <div className="font-medium text-gray-900">
                      {l.companyName}
                    </div>
                    {l.email && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {l.email}
                      </div>
                    )}
                  </td>
                  <td className="p-3 align-top">
                    <div className="text-gray-800">{l.mobile}</div>
                  </td>
                  <td className="p-3 align-top">
                    {assignedUser ? (
                      <>
                        <div className="text-gray-900 text-sm font-medium">
                          {assignedUser.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {assignedRole}
                        </div>
                      </>
                    ) : (
                      <span className="text-red-600 text-sm font-medium">
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td className="p-3 align-top max-w-xs">
                    <div className="text-gray-700 line-clamp-2">
                      {getComment(l) || (
                        <span className="text-gray-400 italic">
                          No comment
                        </span>
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
                    <button
                      type="button"
                      onClick={() => setSelected(l)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs"
                    >
                      <Eye className="w-3 h-3" />
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  No records found for this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
          onRefresh={() => {
            setSelected(null);
            if (token) {
              apiFetch('/leads', token)
                .then((data) => setLeads(data || []))
                .catch(console.error);
            }
          }}
        />
      )}
    </div>
  );
}
