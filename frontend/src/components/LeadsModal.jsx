// src/components/LeadDetailModal.jsx
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { apiFetch } from '../api';

const LEAD_STATUS = {
  LEAD: 'lead',
  CALLBACK: 'callback',
  SALE: 'sale'
};

export default function LeadDetailModal({ onClose, onSuccess, token, user }) {
  const [loading, setLoading] = useState(false);
  const [newLead, setNewLead] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    status: LEAD_STATUS.LEAD,
    dueDate: '',
    notes: '',
    value: '',
    tags: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic required fields
    if (!newLead.name || !newLead.contactPerson || !newLead.email) {
      alert('Please fill in company name, contact person, and email.');
      return;
    }

    setLoading(true);

    // Build payload using server's expected field names
    const payload = {
      companyName: newLead.name,
      contactPerson: newLead.contactPerson,
      email: newLead.email,
      mobile: newLead.phone || '',
      status: newLead.status,
      dueDate: newLead.dueDate ? new Date(newLead.dueDate).toISOString() : null,
      notes: newLead.notes || null,
      value: newLead.value ? parseFloat(newLead.value) : 0,
      tags: newLead.tags ? newLead.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      assignedToId: user?.id || null,
      teamName: user?.team ? (typeof user.team === 'string' ? user.team : user.team.name) : null
    };

    try {
      await apiFetch('/leads', token, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      await onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to add lead');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-xl font-bold text-gray-900">Add New Lead</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newLead.name}
                onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Acme Corporation"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact Person <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newLead.contactPerson}
                onChange={(e) => setNewLead({ ...newLead, contactPerson: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={newLead.email}
                onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="john@acme.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone
              </label>
              <input
                type="tel"
                value={newLead.phone}
                onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="+1 (555) 000-0000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Due Date
              </label>
              <input
                type="date"
                value={newLead.dueDate}
                onChange={(e) => setNewLead({ ...newLead, dueDate: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estimated Value ($)
              </label>
              <input
                type="number"
                value={newLead.value}
                onChange={(e) => setNewLead({ ...newLead, value: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="10000"
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={newLead.status}
                onChange={(e) => setNewLead({ ...newLead, status: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value={LEAD_STATUS.LEAD}>Lead</option>
                <option value={LEAD_STATUS.CALLBACK}>Call Back</option>
                <option value={LEAD_STATUS.SALE}>Sale</option>
                
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <input
                type="text"
                value={newLead.tags}
                onChange={(e) => setNewLead({ ...newLead, tags: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="enterprise, urgent, high-value"
              />
              <p className="text-xs text-gray-500 mt-1">Separate tags with commas</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={newLead.notes}
                onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                rows="4"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                placeholder="Add any additional notes about this lead..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Adding...' : 'Add Lead'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
