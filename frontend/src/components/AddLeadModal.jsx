// src/components/AddLeadModal.jsx
import React, { useState, useMemo } from 'react';
import { X, Building, Calendar, FileText } from 'lucide-react';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { apiFetch } from '../api';

export default function AddLeadModal({
  onClose,
  onSuccess,
  token,
  user = {},
  users = [],
  userRole = 'sales_rep',
  initialStatus = 'lead',
}) {
  const [loading, setLoading] = useState(false);
  const [dueDatePicker, setDueDatePicker] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 24);
    return d;
  });

  const [formData, setFormData] = useState({
    saleDate: '',
    agentName: '',
    closerName: '',
    pseudo: '',
    companyName: '',
    companyType: '',
    registrationNumber: '',
    tradingName: '',
    numberOfDirectors: '',
    companyAddress: '',
    businessNature: '',
    landline: '',
    mobile: '',
    email: '',
    website: '',
    directorOwnerName1: '',
    position1: '',
    dob1: '',
    nationality1: '',
    homeAddress1: '',
    directorOwnerName2: '',
    position2: '',
    dob2: '',
    nationality2: '',
    homeAddress2: '',
    tenure: '',
    previousAddress: '',
    offeredCompany: '',
    offeredTerms: '',
    existingCompany: '',
    remainingTerms: '',
    alreadyPayingCharges: '',
    details: '',
    totalTurnover: '',
    cardTurnover: '',
    avgTransaction: '',
    minTransaction: '',
    maxTransaction: '',
    monthlyLineRent: '',
    debitPercentage: '',
    creditPercentage: '',
    authorizationFee: '',
    otherCards: '',
    accountTitle: '',
    accountNumber: '',
    sortCode: '',
    iban: '',
    bankName: '',
    status: initialStatus || 'lead',
    dueDate: '',
    tags: '',
    assignedToId: '',
    leadComment: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

    const availableAssignees = useMemo(() => {
    if (!Array.isArray(users)) return [];

    const normalizedRoleRaw =
      typeof userRole === 'string' ? userRole : String(userRole || '');
    const normalizedRole = normalizedRoleRaw.toLowerCase();

    const primaryTeam =
      typeof user?.team === 'string' ? user.team : user?.team?.name;

    // collect all teams this user leads
    const leadTeamNames = Array.isArray(user?.leadTeams)
      ? user.leadTeams
          .map((lt) =>
            lt.team
              ? (typeof lt.team === 'string' ? lt.team : lt.team.name)
              : null
          )
          .filter(Boolean)
      : [];

    const allowedTeamNames = Array.from(
      new Set([primaryTeam, ...leadTeamNames].filter(Boolean))
    );

    const getUserTeamName = (u) =>
      u?.team
        ? (typeof u.team === 'string' ? u.team : u.team.name)
        : null;

    // Admin → everyone
    if (normalizedRole === 'admin') return users;

    // Team lead → all members of ANY team they lead
    if (
      normalizedRole === 'team_lead' ||
      normalizedRole === 'team lead' ||
      normalizedRole === 'team-lead'
    ) {
      if (!allowedTeamNames.length) return [];
      return users.filter((u) => {
        const tName = getUserTeamName(u);
        return tName && allowedTeamNames.includes(tName);
      });
    }

    // Regular users: you decided they cannot freely assign, so keep [] (backend will default to self)
    return [];
  }, [users, userRole, user]);


  const validateMinimum = () => {
    if (!formData.companyName || !formData.companyAddress || !formData.businessNature || !formData.mobile) {
      return 'Please fill in required fields: Customer Name,Company Name, Company Address, Business Nature and Mobile';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validateMinimum();
    if (validationError) {
      alert(validationError);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        // sale info
        saleDate: formData.saleDate ? new Date(formData.saleDate).toISOString() : null,
        agentName: formData.agentName || null,
        closerName: formData.closerName || null,
        pseudo: formData.pseudo || null,

        // company (customer)
        companyName: formData.companyName,

        companyType: formData.companyType || null,
        registrationNumber: formData.registrationNumber || null,
        tradingName: formData.tradingName || null,
        numberOfDirectors: formData.numberOfDirectors ? parseInt(formData.numberOfDirectors, 10) : null,
        companyAddress: formData.companyAddress,
        businessNature: formData.businessNature,
        landline: formData.landline || null,
        mobile: formData.mobile,
        email: formData.email && formData.email.trim() !== '' ? formData.email.trim() : null,
        website: formData.website || null,

        // owners
        directorOwnerName1: formData.directorOwnerName1 || null,
        position1: formData.position1 || null,
        dob1: formData.dob1 ? new Date(formData.dob1).toISOString() : null,
        nationality1: formData.nationality1 || null,
        homeAddress1: formData.homeAddress1 || null,

        directorOwnerName2: formData.directorOwnerName2 || null,
        position2: formData.position2 || null,
        dob2: formData.dob2 ? new Date(formData.dob2).toISOString() : null,
        nationality2: formData.nationality2 || null,
        homeAddress2: formData.homeAddress2 || null,

        tenure: formData.tenure || null,
        previousAddress: formData.previousAddress || null,

        // payment
        offeredCompany: formData.offeredCompany || null,
        offeredTerms: formData.offeredTerms || null,
        existingCompany: formData.existingCompany || null,
        remainingTerms: formData.remainingTerms || null,
        alreadyPayingCharges: formData.alreadyPayingCharges || null,
        details: formData.details || null,
        totalTurnover: formData.totalTurnover ? parseFloat(formData.totalTurnover) : null,
        cardTurnover: formData.cardTurnover ? parseFloat(formData.cardTurnover) : null,
        avgTransaction: formData.avgTransaction ? parseFloat(formData.avgTransaction) : null,
        minTransaction: formData.minTransaction ? parseFloat(formData.minTransaction) : null,
        maxTransaction: formData.maxTransaction ? parseFloat(formData.maxTransaction) : null,
        monthlyLineRent: formData.monthlyLineRent ? parseFloat(formData.monthlyLineRent) : null,
        debitPercentage: formData.debitPercentage ? parseFloat(formData.debitPercentage) : null,
        creditPercentage: formData.creditPercentage ? parseFloat(formData.creditPercentage) : null,
        authorizationFee: formData.authorizationFee ? parseFloat(formData.authorizationFee) : null,
        otherCards: formData.otherCards || null,

        // banking
        accountTitle: formData.accountTitle || null,
        accountNumber: formData.accountNumber || null,
        sortCode: formData.sortCode || null,
        iban: formData.iban || null,
        bankName: formData.bankName || null,

        // lead management
        status: formData.status || 'lead',
        assignedToId: formData.assignedToId
          ? parseInt(formData.assignedToId, 10)
          : (user?.id || null),
        teamName: user?.team
          ? (typeof user.team === 'string' ? user.team : user.team.name)
          : null,
        dueDate: formData.dueDate
          ? formData.dueDate
          : (dueDatePicker ? dueDatePicker.toISOString() : null),
        tags: formData.tags
          ? formData.tags.split(',').map(t => t.trim()).filter(Boolean)
          : [],
        leadComment: formData.leadComment || null,
      };

      const created = await apiFetch('/leads', token, {
        method: 'POST',
        body: payload,
      });

      if (typeof onSuccess === 'function') await onSuccess(created);
      if (typeof onClose === 'function') onClose();
    } catch (err) {
      console.error('AddLead error', err);
      alert(err.message || 'Failed to create record');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-xl font-bold text-white">Add New {formData.status === 'sale' ? 'Sale' : formData.status === 'callback' ? 'Call Back' : formData.status === 'transfer' ? 'Transfer' : 'Lead'}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Contact Information (formerly Sale Information) */}
          <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              Contact Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sale Date</label>
                <input
                  type="date"
                  name="saleDate"
                  value={formData.saleDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agent Name</label>
                <input
                  type="text"
                  name="agentName"
                  value={formData.agentName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Closer Name</label>
                <input
                  type="text"
                  name="closerName"
                  value={formData.closerName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pseudo</label>
                <input
                  type="text"
                  name="pseudo"
                  value={formData.pseudo}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Company / Customer Details */}
          <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building className="w-5 h-5 text-blue-600" />
              Company / Customer Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Acme Corporation Ltd"
                />
              </div>
              <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Customer Name
    </label>
    <input
      name="directorOwnerName1"
      value={formData.directorOwnerName1}
      onChange={handleChange}
      className="w-full px-3 py-2 border rounded-lg"
      placeholder="Primary director / customer name"
    />
  </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Type</label>
                <select
                  name="companyType"
                  value={formData.companyType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select type...</option>
                  <option value="Ltd & Partnership">Ltd & Partnership</option>
                  <option value="Sole Trader">Sole Trader</option>
                  <option value="Charity">Charity</option>
                </select>
              </div>

              <div className="lg:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="companyAddress"
                  value={formData.companyAddress}
                  onChange={handleChange}
                  required
                  rows="2"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Business Nature <span className="text-red-500">*</span>
                </label>
                <input
                  name="businessNature"
                  value={formData.businessNature}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Retail, Services, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mobile <span className="text-red-500">*</span>
                </label>
                <input
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email (optional)
                </label>
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website
                </label>
                <input
                  name="website"
                  type="url"
                  value={formData.website}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Lead Management */}
          <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-200">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" /> Lead Management
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="lead">Lead</option>
                  <option value="callback">Call Back</option>
                  <option value="sale">Sale</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date &amp; Time
                </label>
                <ReactDatePicker
                  selected={dueDatePicker}
                  onChange={date => {
                    setDueDatePicker(date);
                    setFormData(prev => ({
                      ...prev,
                      dueDate: date ? date.toISOString() : '',
                    }));
                  }}
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  dateFormat="yyyy-MM-dd HH:mm"
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholderText="Select date and time"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Pick both date and time (local).
                </p>
              </div>

              {(userRole === 'admin' ||
                userRole === 'team_lead' ||
                userRole === 'Team Lead') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assign To
                  </label>
                  <select
                    name="assignedToId"
                    value={formData.assignedToId}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">Unassigned</option>
                    {availableAssignees.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name}{' '}
                        {u.team
                          ? `(${typeof u.team === 'string'
                              ? u.team
                              : u.team?.name})`
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags
                </label>
                <input
                  name="tags"
                  value={formData.tags}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="urgent, high-value"
                />
                <p className="text-xs text-gray-500 mt-1">Comma-separated</p>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Comment
              </label>
              <textarea
                name="leadComment"
                value={formData.leadComment || ''}
                onChange={handleChange}
                rows="4"
                className="w-full px-3 py-2 border rounded-lg resize-none"
                placeholder="Add a comment..."
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg"
            >
              {loading ? 'Adding...' : 'Add'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
