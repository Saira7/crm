import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import { apiFetch } from '../api';
import {
  Users,
  CheckCircle,
  DollarSign,
  AlertCircle,
  ArrowRight,
  Calendar
} from 'lucide-react';

const LEAD_STATUS = {
  LEAD: 'lead',
  CALLBACK: 'callback',
  SALE: 'sale'
};


export default function Dashboard() {
  const { token, user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  const userRole = user?.role
    ? (typeof user.role === 'string' ? user.role : user.role?.name ?? String(user.role))
    : 'user';
  const userTeam = user?.team
    ? (typeof user.team === 'string' ? user.team : user.team?.name ?? String(user.team))
    : null;

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    apiFetch('/leads', token)
      .then(data => {
        setLeads(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [token]);

  // Filter accessible leads
  const accessibleLeads = React.useMemo(() => {
    if (!user) return [];
    if (userRole === 'admin') return leads;
    if (userRole === 'team_lead') return leads.filter(l => l.teamName === userTeam);
    return leads.filter(l => l.assignedToId === user.id);
  }, [leads, user, userRole, userTeam]);

  // Calculate due leads
  const todayISO = new Date().toISOString().split('T')[0];
  const dueLeads = accessibleLeads.filter(l => {
    if (!l.dueDate) return false;
    const due = new Date(l.dueDate).toISOString().split('T')[0];
    return due <= todayISO && l.status !== LEAD_STATUS.WON && l.status !== LEAD_STATUS.LOST;
  });

  const totalValue = accessibleLeads.reduce((sum, l) => sum + (l.value || 0), 0);
  const sales = accessibleLeads.filter(l => l.status === LEAD_STATUS.SALE).length;

  const getStatusColor = (status) => {
    const map = {
      [LEAD_STATUS.LEAD]: 'bg-blue-100 text-blue-800',
      [LEAD_STATUS.CALLBACK]: 'bg-purple-100 text-purple-800',
      [LEAD_STATUS.SALE]: 'bg-green-100 text-green-800',
     
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  };

  if (!token) {
    navigate('/');
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back, {user?.name || 'User'}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Leads */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Leads</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{accessibleLeads.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Due Today */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Due Today</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">{dueLeads.length}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Won */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Sales</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{sales}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Total Value
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Value</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">${totalValue.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div> */}
      </div>

      {/* Reminders Section */}
      {dueLeads.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-50 to-red-50 px-6 py-4 border-b border-orange-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Reminders - Due Today & Overdue</h2>
                  <p className="text-sm text-gray-600">{dueLeads.length} lead{dueLeads.length !== 1 ? 's' : ''} need{dueLeads.length === 1 ? 's' : ''} attention</p>
                </div>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {dueLeads.map(lead => (
              <div 
                key={lead.id} 
                className="p-6 hover:bg-gray-50 transition-colors cursor-pointer group"
                onClick={() => navigate('/leads')}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {lead.name}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>
                        {lead.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{lead.contactPerson}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Calendar className="w-4 h-4" />
                        <span>Due: {lead.dueDate ? new Date(lead.dueDate).toLocaleDateString() : '—'}</span>
                      </div>
                      {lead.value && (
                        <div className="flex items-center gap-2 text-gray-500">
                          <DollarSign className="w-4 h-4" />
                          <span>${lead.value.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button 
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/leads');
                    }}
                  >
                    View
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && accessibleLeads.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No leads yet</h3>
          <p className="text-gray-600 mb-6">Get started by adding your first lead</p>
          <button
            onClick={() => navigate('/leads')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Leads
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}