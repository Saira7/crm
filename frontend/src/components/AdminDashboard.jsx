// src/components/AdminDashboard.jsx
import React, { useContext, useEffect, useState, useMemo } from 'react';
import { AuthContext } from './AuthContext';
import { apiFetch } from '../api';
import { BarChart3, Filter, Users, Target } from 'lucide-react';

export default function AdminDashboard() {
  const { token, user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState('');

  const [teamFilter, setTeamFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const userRole = user?.role
    ? (typeof user.role === 'string' ? user.role : user.role.name)
    : null;
  const normRole = (userRole || '').toString().toLowerCase();

  const isAdmin = normRole === 'admin';

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (teamFilter) params.set('teamId', teamFilter);
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      const qs = params.toString();
      const data = await apiFetch(
        `/admin/overview${qs ? `?${qs}` : ''}`,
        token
      );
      setMetrics(data || null);
    } catch (err) {
      console.error('Failed to load admin overview', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAdmin]);

  const teamsForFilter = useMemo(() => {
    if (!metrics?.teams) return [];
    return metrics.teams;
  }, [metrics]);

  if (!isAdmin) {
    return (
      <div className="p-4 sm:p-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
          Admin Dashboard
        </h1>
        <p className="text-gray-600 text-sm">
          Only admins can view this page.
        </p>
      </div>
    );
  }

  if (loading && !metrics) {
    return (
      <div className="p-4 sm:p-8">
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const totals = metrics?.totals || {};
  const statusDistribution = metrics?.statusDistribution || [];
  const byTeam = metrics?.byTeam || [];
  const byAgent = metrics?.byAgent || [];

  return (
    <div className="p-4 sm:p-5 lg:p-8 space-y-5 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            Admin Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            High-level overview of leads, sales, teams and agents across the
            system.
          </p>
        </div>

        {/* Filters */}
        <div className="w-full lg:w-auto bg-white lg:bg-transparent border lg:border-0 border-gray-200 rounded-lg lg:rounded-none p-3 lg:p-0 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-gray-500 hidden sm:block" />
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="flex-1 sm:flex-none px-2 py-1.5 border rounded-lg text-xs"
            >
              <option value="">All teams</option>
              {teamsForFilter.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="flex-1 sm:flex-none px-2 py-1.5 border rounded-lg text-xs"
            />
            <span className="text-xs text-gray-500">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="flex-1 sm:flex-none px-2 py-1.5 border rounded-lg text-xs"
            />
          </div>

          <button
            onClick={load}
            className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
          >
            Apply
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase font-semibold">
            Total Leads
          </p>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-gray-900">
            {totals.totalLeads ?? 0}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase font-semibold">
            Callbacks
          </p>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-blue-600">
            {totals.totalCallbacks ?? 0}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase font-semibold flex items-center gap-1">
            Sales <Target className="w-3 h-3 text-green-500" />
          </p>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-green-600">
            {totals.totalSales ?? 0}
          </p>
          <p className="mt-1 text-[11px] sm:text-xs text-gray-500">
            Conversion: {totals.conversionRate ?? 0}%
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase font-semibold">
            Overdue
          </p>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-red-600">
            {totals.overdueCount ?? 0}
          </p>
        </div>
      </div>

      {/* Status distribution + by team */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Status distribution */}
        <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">
            Status distribution
          </h2>
          {statusDistribution.length === 0 ? (
            <p className="text-xs text-gray-500">No data for this range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-xs">
                <thead className="border-b bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left p-2">Status</th>
                    <th className="text-right p-2">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {statusDistribution.map((row) => (
                    <tr
                      key={row.status}
                      className="border-b last:border-b-0"
                    >
                      <td className="p-2 capitalize">{row.status}</td>
                      <td className="p-2 text-right font-semibold">
                        {row.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* By team */}
        <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">
            Teams performance
          </h2>
          {byTeam.length === 0 ? (
            <p className="text-xs text-gray-500">No data for this range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px] text-xs">
                <thead className="border-b bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left p-2">Team</th>
                    <th className="text-right p-2">Leads</th>
                    <th className="text-right p-2">Sales</th>
                    <th className="text-right p-2">Conv. %</th>
                  </tr>
                </thead>
                <tbody>
                  {byTeam.map((row) => {
                    const conv =
                      row.totalLeads > 0
                        ? ((row.sales / row.totalLeads) * 100).toFixed(1)
                        : '0.0';
                    return (
                      <tr
                        key={row.teamName || 'none'}
                        className="border-b last:border-b-0"
                      >
                        <td className="p-2">{row.teamName || 'Unassigned'}</td>
                        <td className="p-2 text-right">{row.totalLeads}</td>
                        <td className="p-2 text-right">{row.sales}</td>
                        <td className="p-2 text-right">{conv}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Top agents */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            Agents performance
          </h2>
        </div>
        {byAgent.length === 0 ? (
          <p className="text-xs text-gray-500">
            No agent activity for this range.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-xs">
              <thead className="border-b bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left p-2">Agent</th>
                  <th className="text-left p-2">Team</th>
                  <th className="text-right p-2">Leads</th>
                  <th className="text-right p-2">Sales</th>
                  <th className="text-right p-2">Conv. %</th>
                </tr>
              </thead>
              <tbody>
                {byAgent
                  .slice()
                  .sort((a, b) => (b.sales || 0) - (a.sales || 0))
                  .map((row) => {
                    const conv =
                      row.totalLeads > 0
                        ? ((row.sales / row.totalLeads) * 100).toFixed(1)
                        : '0.0';
                    return (
                      <tr key={row.userId} className="border-b last:border-b-0">
                        <td className="p-2 align-top">
                          <div className="font-semibold text-gray-900">
                            {row.name}
                          </div>
                          {row.email && (
                            <div className="text-[11px] text-gray-500">
                              {row.email}
                            </div>
                          )}
                        </td>
                        <td className="p-2 align-top">
                          {row.teamName || '-'}
                        </td>
                        <td className="p-2 text-right align-top">
                          {row.totalLeads}
                        </td>
                        <td className="p-2 text-right align-top">
                          {row.sales}
                        </td>
                        <td className="p-2 text-right align-top">
                          {conv}%
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
