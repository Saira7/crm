import React, { useState, useMemo  } from 'react';
import { X, Building, User, CreditCard, Landmark, Calendar, FileText } from 'lucide-react';
import ReactDatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

export default function AddLeadModal({ onClose, onSuccess, token, user = {}, users = [], userRole = 'sales_rep'  }) {
  const [loading, setLoading] = useState(false);
  const [dueDatePicker, setDueDatePicker] = useState(() => {
    // default: now + 24 hours
    const d = new Date();
    d.setHours(d.getHours() + 24);
    return d;
  });

  const [formData, setFormData] = useState({
    // Sale Information
    saleDate: '',
    agentName: '',
    closerName: '',
    pseudo: '',
    
    // Company Details (Required)
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
    
    // Customer/Owner Details - Director 1
    directorOwnerName1: '',
    position1: '',
    dob1: '',
    nationality1: '',
    homeAddress1: '',
    
    // Customer/Owner Details - Director 2
    directorOwnerName2: '',
    position2: '',
    dob2: '',
    nationality2: '',
    homeAddress2: '',
    
    tenure: '',
    previousAddress: '',
    
    // Payment Processing Details
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
    
    // Banking Details
    accountTitle: '',
    accountNumber: '',
    sortCode: '',
    iban: '',
    bankName: '',
    
    // Lead Management
    status: 'lead',
    dueDate: '', // This will be set by the date picker
    tags: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const availableAssignees = useMemo(() => {
    if (!Array.isArray(users)) return [];
    if (userRole === 'admin') return users;
    if (userRole === 'team_lead') {
      const myTeam = typeof user?.team === 'string' ? user.team : user?.team?.name;
      return users.filter(u => {
        const uTeam = typeof u.team === 'string' ? u.team : u.team?.name;
        return uTeam === myTeam;
      });
    }
    return [];
  }, [users, userRole, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.companyName || !formData.companyAddress || !formData.businessNature || !formData.mobile || !formData.email) {
      alert('Please fill in all required fields: Company Name, Company Address, Business Nature, Mobile, and Email');
      return;
    }

    setLoading(true);

    try {
      // Build payload matching your database schema
      const payload = {
        // Sale Information
        saleDate: formData.saleDate ? new Date(formData.saleDate).toISOString() : null,
        agentName: formData.agentName || null,
        closerName: formData.closerName || null,
        pseudo: formData.pseudo || null,
        
        // Company Details
        companyName: formData.companyName,
        companyType: formData.companyType || null,
        registrationNumber: formData.registrationNumber || null,
        tradingName: formData.tradingName || null,
        numberOfDirectors: formData.numberOfDirectors ? parseInt(formData.numberOfDirectors, 10) : null,
        companyAddress: formData.companyAddress,
        businessNature: formData.businessNature,
        landline: formData.landline || null,
        mobile: formData.mobile,
        email: formData.email,
        website: formData.website || null,
        
        // Customer/Owner Details - Director 1
        directorOwnerName1: formData.directorOwnerName1 || null,
        position1: formData.position1 || null,
        dob1: formData.dob1 ? new Date(formData.dob1).toISOString() : null,
        nationality1: formData.nationality1 || null,
        homeAddress1: formData.homeAddress1 || null,
        
        // Customer/Owner Details - Director 2
        directorOwnerName2: formData.directorOwnerName2 || null,
        position2: formData.position2 || null,
        dob2: formData.dob2 ? new Date(formData.dob2).toISOString() : null,
        nationality2: formData.nationality2 || null,
        homeAddress2: formData.homeAddress2 || null,
        
        tenure: formData.tenure || null,
        previousAddress: formData.previousAddress || null,
        
        // Payment Processing Details
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
        
        // Banking Details
        accountTitle: formData.accountTitle || null,
        accountNumber: formData.accountNumber || null,
        sortCode: formData.sortCode || null,
        iban: formData.iban || null,
        bankName: formData.bankName || null,
        
        // Lead Management
        status: formData.status || 'lead',
        assignedToId: user?.id || null,
        teamName: user?.team ? (typeof user.team === 'string' ? user.team : user.team.name) : null,
        dueDate: formData.dueDate || null, // This will now contain the proper ISO string from date picker
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      };

      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create lead');
      }

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
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-xl font-bold text-white">Add New Lead</h2>
          <button onClick={onClose} className="p-2 hover:bg-blue-500 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Sale Information */}
          <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              Sale Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sale Date</label>
                <input
                  type="date"
                  name="saleDate"
                  value={formData.saleDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agent Name</label>
                <input
                  type="text"
                  name="agentName"
                  value={formData.agentName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Closer Name</label>
                <input
                  type="text"
                  name="closerName"
                  value={formData.closerName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pseudo</label>
                <input
                  type="text"
                  name="pseudo"
                  value={formData.pseudo}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Company Details */}
          <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building className="w-5 h-5 text-blue-600" />
              Company Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Acme Corporation Ltd"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Type</label>
                <select
                  name="companyType"
                  value={formData.companyType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select type...</option>
                  <option value="Ltd & Partnership">Ltd & Partnership</option>
                  <option value="Sole Trader">Sole Trader</option>
                  <option value="Charity">Charity</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
                <input
                  type="text"
                  name="registrationNumber"
                  value={formData.registrationNumber}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trading Name</label>
                <input
                  type="text"
                  name="tradingName"
                  value={formData.tradingName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number of Directors</label>
                <input
                  type="number"
                  name="numberOfDirectors"
                  value={formData.numberOfDirectors}
                  onChange={handleChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="123 Business St, London, UK"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Business Nature <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="businessNature"
                  value={formData.businessNature}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Retail, Services, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Landline</label>
                <input
                  type="tel"
                  name="landline"
                  value={formData.landline}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mobile <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com"
                />
              </div>
            </div>
          </div>

          {/* Director/Owner 1 */}
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-gray-600" />
              Director/Owner 1
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  name="directorOwnerName1"
                  value={formData.directorOwnerName1}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                <input
                  type="text"
                  name="position1"
                  value={formData.position1}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Director, CEO, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  name="dob1"
                  value={formData.dob1}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
                <input
                  type="text"
                  name="nationality1"
                  value={formData.nationality1}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Home Address</label>
                <textarea
                  name="homeAddress1"
                  value={formData.homeAddress1}
                  onChange={handleChange}
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </div>

          {/* Director/Owner 2 */}
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-gray-600" />
              Director/Owner 2
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  name="directorOwnerName2"
                  value={formData.directorOwnerName2}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                <input
                  type="text"
                  name="position2"
                  value={formData.position2}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Director, COO, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  name="dob2"
                  value={formData.dob2}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
                <input
                  type="text"
                  name="nationality2"
                  value={formData.nationality2}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Home Address</label>
                <textarea
                  name="homeAddress2"
                  value={formData.homeAddress2}
                  onChange={handleChange}
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </div>

          {/* Additional Owner Info */}
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Additional Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tenure (Years at Address)</label>
                <input
                  type="text"
                  name="tenure"
                  value={formData.tenure}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Previous Address</label>
                <input
                  type="text"
                  name="previousAddress"
                  value={formData.previousAddress}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Payment Processing Details */}
          <div className="bg-green-50 rounded-xl p-6 border border-green-200">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-green-600" />
              Payment Processing Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Offered Company</label>
                <input
                  type="text"
                  name="offeredCompany"
                  value={formData.offeredCompany}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Offered Terms</label>
                <input
                  type="text"
                  name="offeredTerms"
                  value={formData.offeredTerms}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Existing Company</label>
                <input
                  type="text"
                  name="existingCompany"
                  value={formData.existingCompany}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remaining Terms</label>
                <input
                  type="text"
                  name="remainingTerms"
                  value={formData.remainingTerms}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Already Paying Charges</label>
                <input
                  type="text"
                  name="alreadyPayingCharges"
                  value={formData.alreadyPayingCharges}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="lg:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Details</label>
                <textarea
                  name="details"
                  value={formData.details}
                  onChange={handleChange}
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Turnover (£)</label>
                <input
                  type="number"
                  name="totalTurnover"
                  value={formData.totalTurnover}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Card Turnover (£)</label>
                <input
                  type="number"
                  name="cardTurnover"
                  value={formData.cardTurnover}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Avg Transaction (£)</label>
                <input
                  type="number"
                  name="avgTransaction"
                  value={formData.avgTransaction}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Transaction (£)</label>
                <input
                  type="number"
                  name="minTransaction"
                  value={formData.minTransaction}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Transaction (£)</label>
                <input
                  type="number"
                  name="maxTransaction"
                  value={formData.maxTransaction}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Line Rent (£)</label>
                <input
                  type="number"
                  name="monthlyLineRent"
                  value={formData.monthlyLineRent}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Debit Percentage (%)</label>
                <input
                  type="number"
                  name="debitPercentage"
                  value={formData.debitPercentage}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Credit Percentage (%)</label>
                <input
                  type="number"
                  name="creditPercentage"
                  value={formData.creditPercentage}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Authorization Fee (£)</label>
                <input
                  type="number"
                  name="authorizationFee"
                  value={formData.authorizationFee}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="lg:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Other Cards</label>
                <input
                  type="text"
                  name="otherCards"
                  value={formData.otherCards}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Amex, Diners, etc."
                />
              </div>
            </div>
          </div>

          {/* Banking Details */}
          <div className="bg-yellow-50 rounded-xl p-6 border border-yellow-200">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-yellow-600" />
              Banking Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Title</label>
                <input
                  type="text"
                  name="accountTitle"
                  value={formData.accountTitle}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                <input
                  type="text"
                  name="bankName"
                  value={formData.bankName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                <input
                  type="text"
                  name="accountNumber"
                  value={formData.accountNumber}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort Code</label>
                <input
                  type="text"
                  name="sortCode"
                  value={formData.sortCode}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="00-00-00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
                <input
                  type="text"
                  name="iban"
                  value={formData.iban}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Lead Management + Assignment + Comment */}
          <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-200">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              Lead Management
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select name="status" value={formData.status} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg">
                  <option value="lead">Lead</option>
                  <option value="callback">Callback</option>
                  <option value="sale">Sale</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date & Time</label>

                {/* react-datepicker calendar + time picker */}
                <ReactDatePicker
                  selected={dueDatePicker}
                  onChange={date => {
                    setDueDatePicker(date);
                    // Also update the formData with the ISO string for submission
                    setFormData(prev => ({
                      ...prev,
                      dueDate: date ? date.toISOString() : ''
                    }));
                  }}
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  dateFormat="yyyy-MM-dd HH:mm"
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholderText="Select date and time"
                />
                <p className="text-xs text-gray-500 mt-1">Pick both date and time (local).</p>
              </div>

              {(userRole === 'admin' || userRole === 'team_lead') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                  <select name="assignedToId" value={formData.assignedToId} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg">
                    <option value="">Unassigned</option>
                    {availableAssignees.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} {u.team ? `(${typeof u.team === 'string' ? u.team : u.team?.name})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">{userRole === 'team_lead' ? 'You can assign only to teammates.' : 'Admins can assign to anyone.'}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                <input name="tags" value={formData.tags} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" placeholder="urgent, high-value" />
                <p className="text-xs text-gray-500 mt-1">Comma-separated</p>
              </div>
            </div>

            {/* Comment box */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
              <textarea name="leadComment" value={formData.leadComment} onChange={handleChange} rows="4" placeholder="Add a comment about this lead..." className="w-full px-3 py-2 border rounded-lg resize-none" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? 'Adding Lead...' : 'Add Lead'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}