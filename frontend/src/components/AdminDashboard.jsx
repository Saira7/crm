// src/components/AdminDashboard.jsx
import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from './AuthContext';
import { apiFetch } from '../api';
import {
  BarChart3,
  Users,
  Briefcase,
  TrendingUp,
  Clock,
} from 'lucide-react';

export default function AdminDashboard() {
  const { token, user } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const userRole = user?.role
    ? (typeof user.role === 'string' ? user.role : user.role.name)
    : null;
  const normRole = (userRole || '').toString().toLowerCase();
  const isAdmin = normRole === 'admin';

  useEffect(() => {
    if (!token || !isAdmin) return;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiFetch('/leads/analytics', token);
        setStats(data || null);
      } catch (err) {
        console.error('Failed to load admin analytics', err);
        setError(err.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token, isAdmin]);

  if (!isAdmin) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Admin Dashboard
        </h1>
        <p className="text-gray-600">
          Only administrators can view this dashboard.
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

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Admin Dashboard
        </h1>
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Admin Dashboard
        </h1>
        <p className="text-gray-600 text-sm">No analytics data available.</p>
      </div>
    );
  }

  const { totals = {}, byStatus = {}, byTeam = [], byUser = [], timeBuckets = {} } = stats;

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Admin Dashboard
          </h1>
          <p className="text-sm text-gray-500">
            High-level overview of leads, sales, teams and agent performance.
          </p>
        </div>
        {stats.generatedAt && (
          <div className="text-xs text-gray-400">
            Last updated:{' '}
            {new Date(stats.generatedAt).toLocaleString()}
          </div>
        )}
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Total Leads</p>
            <p className="text-xl font-bold text-gray-900">
              {totals.totalLeads ?? 0}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Total Sales</p>
            <p className="text-xl font-bold text-gray-900">
              {totals.totalSales ?? 0}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-yellow-50 flex items-center justify-center">
            <Clock className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Call Backs</p>
            <p className="text-xl font-bold text-gray-900">
              {totals.totalCallbacks ?? 0}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center">
            <Users className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Transfers</p>
            <p className="text-xl font-bold text-gray-900">
              {totals.totalTransfers ?? 0}
            </p>
          </div>
        </div>
      </div>

      {/* Time-based activity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['today', 'thisWeek', 'thisMonth'].map((key) => {
          const bucket = timeBuckets[key] || {};
          const label =
            key === 'today'
              ? 'Today'
              : key === 'thisWeek'
              ? 'This Week'
              : 'This Month';
          return (
            <div
              key={key}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-600 uppercase">
                  {label}
                </p>
                <Clock className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 mb-1">New leads</p>
              <p className="text-2xl font-bold text-gray-900">
                {bucket.total ?? 0}
              </p>
              <p className="text-xs text-green-600 mt-1">
                Sales: <span className="font-semibold">{bucket.sales ?? 0}</span>
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By team */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800">
              Leads by Team
            </h2>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {byTeam.length === 0 ? (
              <p className="text-sm text-gray-500">No team data.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left p-2">Team</th>
                    <th className="text-right p-2">Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {byTeam.map((row, idx) => (
                    <tr
                      key={row.teamName + idx}
                      className="border-t text-gray-800"
                    >
                      <td className="p-2">{row.teamName}</td>
                      <td className="p-2 text-right font-semibold">
                        {row.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Top agents */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800">
              Top Agents (by assigned leads)
            </h2>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {byUser.length === 0 ? (
              <p className="text-sm text-gray-500">No agent data.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left p-2">Agent</th>
                    <th className="text-left p-2">Team</th>
                    <th className="text-right p-2">Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {byUser.map((row) => (
                    <tr
                      key={row.userId}
                      className="border-t text-gray-800"
                    >
                      <td className="p-2">{row.userName}</td>
                      <td className="p-2 text-gray-500">
                        {row.teamName}
                      </td>
                      <td className="p-2 text-right font-semibold">
                        {row.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Status breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">
          Leads by Status
        </h2>
        <div className="flex flex-wrap gap-3">
          {Object.keys(byStatus).length === 0 && (
            <p className="text-sm text-gray-500">
              No leads found.
            </p>
          )}
          {Object.entries(byStatus).map(([status, count]) => (
            <div
              key={status}
              className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-xs"
            >
              <span className="font-semibold capitalize mr-2">
                {status}
              </span>
              <span className="text-gray-700">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
