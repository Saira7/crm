// src/components/LeadDetailModal.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { X, Save, Edit2 } from 'lucide-react';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const InputRow = ({
  label,
  name,
  type = 'text',
  placeholder = '',
  className = '',
  rows = 1,
  value,
  onChange,
  disabled
}) => {
  if (rows === 1) {
    return (
      <div className={className}>
        <label className="block text-xs text-gray-600 mb-1">
          {label}
        </label>
        <input
          className="w-full px-3 py-2 border rounded"
          type={type}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={onChange}
          disabled={disabled}
        />
      </div>
    );
  }
  return (
    <div className={className}>
      <label className="block text-xs text-gray-600 mb-1">
        {label}
      </label>
      <textarea
        rows={rows}
        className="w-full px-3 py-2 border rounded"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
};

// Move StatusCommentBox outside as well
function StatusCommentBox({
  title,
  existingComment,
  existingDate,
  onAdd,
  disabled,
}) {
  const [txt, setTxt] = useState('');
  useEffect(() => {
    setTxt('');
  }, [existingComment]);
  return (
    <div className="p-4 border rounded">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-gray-500">
          {existingDate
            ? new Date(existingDate).toLocaleString()
            : 'No date'}
        </div>
      </div>
      <div className="text-sm text-gray-700 mb-3">
        {existingComment || (
          <span className="text-gray-400">No comment</span>
        )}
      </div>
      <textarea
        rows={3}
        className="w-full px-3 py-2 border rounded mb-2"
        value={txt}
        onChange={e => setTxt(e.target.value)}
        placeholder={`Add ${title.toLowerCase()}...`}
        disabled={disabled}
      />
      <div className="flex justify-end">
        <button
          onClick={() => {
            if (txt.trim()) onAdd(txt);
          }}
          disabled={disabled || !txt.trim()}
          className="px-3 py-1.5 bg-blue-600 text-white rounded disabled:opacity-60"
        >
          Add Comment
        </button>
      </div>
    </div>
  );
}

export default function LeadDetailModal({
  lead,
  token,
  user,
  users = [],
  onClose,
  onUpdate,
  onRefresh
}) {
  const [local, setLocal] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changedFields, setChangedFields] = useState(new Set());

  useEffect(() => {
    if (!lead) {
      setLocal(null);
      return;
    }
    setLocal({
      ...lead,
      tagsText: Array.isArray(lead.tags)
        ? lead.tags.join(', ')
        : (lead.tags || '').toString(),
      dueDate_date: lead.dueDate ? new Date(lead.dueDate) : null,
      saleDate_local: lead.saleDate
        ? new Date(lead.saleDate).toISOString().split('T')[0]
        : '',
      dob1_local: lead.dob1
        ? new Date(lead.dob1).toISOString().split('T')[0]
        : '',
      dob2_local: lead.dob2
        ? new Date(lead.dob2).toISOString().split('T')[0]
        : '',
    });
    setChangedFields(new Set());
    setEditing(false);
  }, [lead]);

    const userRole = user?.role
    ? (typeof user.role === 'string' ? user.role : user.role.name)
    : null;

  const normRole = (userRole || '').toString().toLowerCase();

  const userTeam = user?.team
    ? (typeof user.team === 'string' ? user.team : user.team.name)
    : null;

  // collect all team names this user leads (from junction table)
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
    new Set([userTeam, ...leadTeamNames].filter(Boolean))
  );

  const getUserTeamName = (u) =>
    u?.team
      ? (typeof u.team === 'string' ? u.team : u.team.name)
      : null;

  const getUserRoleName = (u) =>
    u?.role
      ? (typeof u.role === 'string' ? u.role : u.role.name)
      : null;

const assignableUsers = useMemo(() => {
  if (!Array.isArray(users)) return [];

  const myTeamName = userTeam; // you already computed this above

  const getUserTeamName = (u) =>
    u?.team
      ? (typeof u.team === 'string' ? u.team : u.team.name)
      : null;

  const getUserRoleName = (u) =>
    u?.role
      ? (typeof u.role === 'string' ? u.role : u.role.name)
      : null;

  // Admin → everyone
  if (normRole === 'admin') return users;

  // Team Lead → anyone whose team is in ANY team they lead (same as before)
  if (
    normRole === 'team_lead' ||
    normRole === 'team lead' ||
    normRole === 'team-lead'
  ) {
    if (!allowedTeamNames.length) return [];
    return users.filter((u) => {
      const tName = getUserTeamName(u);
      return tName && allowedTeamNames.includes(tName);
    });
  }

  // Regular user → themselves OR TLs that are:
  //  - primary TL for their team, OR
  //  - lead their team via leadTeams
  if (!myTeamName) return [user].filter(Boolean);

  return users.filter((u) => {
    // always allow self
    if (u.id === user.id) return true;

    const rName = (getUserRoleName(u) || '').toLowerCase();
    const isTL =
      rName === 'team_lead' || rName === 'team lead' || rName === 'team-lead';

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
}, [users, normRole, allowedTeamNames, user.id, userTeam]);




  if (!local) return null;

  const onChange = (field, value) => {
    setLocal(prev => ({ ...prev, [field]: value }));
    setChangedFields(prev => new Set([...prev]).add(field));
  };

  const buildPatch = () => {
    const patch = {};
    for (const f of changedFields) {
      switch (f) {
        case 'tagsText':
          patch.tags = local.tagsText
            ? local.tagsText
                .split(',')
                .map(t => t.trim())
                .filter(Boolean)
            : [];
          break;
        case 'dueDate_date':
          patch.dueDate = local.dueDate_date
            ? local.dueDate_date.toISOString()
            : null;
          break;
        case 'saleDate_local':
          patch.saleDate = local.saleDate_local
            ? new Date(local.saleDate_local).toISOString()
            : null;
          break;
        case 'dob1_local':
          patch.dob1 = local.dob1_local
            ? new Date(local.dob1_local).toISOString()
            : null;
          break;
        case 'dob2_local':
          patch.dob2 = local.dob2_local
            ? new Date(local.dob2_local).toISOString()
            : null;
          break;
        default:
          patch[f] = local[f] === '' ? null : local[f];
      }
    }
    return patch;
  };

  const handleSave = async () => {
    if (changedFields.size === 0) {
      setEditing(false);
      return;
    }
    const patch = buildPatch();
    setSaving(true);
    try {
      await onUpdate(local.id, patch);
      setChangedFields(new Set());
      setEditing(false);
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      console.error('Update failed', err);
      alert(err?.message || 'Failed to update lead');
    } finally {
      setSaving(false);
    }
  };

  const handleAddStatusComment = async (statusKey, commentText) => {
    if (!commentText || !commentText.trim()) {
      alert('Please add a comment.');
      return;
    }
    const commentField = `${statusKey}Comment`;
    const dateField = `${statusKey}CommentDate`;
    const payload = {
      [commentField]: commentText,
      [dateField]: new Date().toISOString(),
    };
    setSaving(true);
    try {
      await onUpdate(local.id, payload);
      setLocal(prev => ({
        ...prev,
        [commentField]: commentText,
        [dateField]: payload[dateField],
      }));
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      console.error('Comment save failed', err);
      alert(err?.message || 'Failed to save comment');
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async (assignedToId) => {
    const parsedId = assignedToId ? parseInt(assignedToId, 10) : null;
    const targetUser = parsedId
      ? assignableUsers.find(u => u.id === parsedId)
      : null;
    const payload = {
      assignedToId: parsedId,
      teamName: targetUser
        ? (typeof targetUser.team === 'string'
            ? targetUser.team
            : targetUser.team?.name ?? null)
        : null,
    };
    setSaving(true);
    try {
      await onUpdate(local.id, payload);
      // Update local state to reflect the assignment
      setLocal(prev => ({
        ...prev,
        assignedToId: parsedId,
        teamName: payload.teamName
      }));
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      console.error('Assign failed', err);
      alert(err?.message || 'Failed to assign lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-start justify-between gap-4 z-10">
          <div>
            <h3 className="text-xl font-bold">
              {local.companyName || 'Lead'}
            </h3>
            <div className="text-sm text-gray-500">
              {local.companyType && `${local.companyType} • `}
              {local.businessNature}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(prev => !prev)}
              className="inline-flex items-center gap-2 px-3 py-2 border rounded hover:bg-gray-50"
            >
              <Edit2 className="w-4 h-4" />{' '}
              {editing ? 'Editing' : 'Edit'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !editing}
              className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-60"
            >
              <Save className="w-4 h-4" />{' '}
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 rounded border"
            >
              Close
            </button>
          </div>
        </div>
        <div className="p-6 space-y-6">
          {/* Company / Contacts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <InputRow 
              label="Company Name" 
              name="companyName" 
              value={local.companyName}
              onChange={e => onChange('companyName', e.target.value)}
              disabled={!editing}
            />
            <InputRow 
              label="Company Type" 
              name="companyType" 
              value={local.companyType}
              onChange={e => onChange('companyType', e.target.value)}
              disabled={!editing}
            />
            <InputRow 
              label="Trading Name" 
              name="tradingName" 
              value={local.tradingName}
              onChange={e => onChange('tradingName', e.target.value)}
              disabled={!editing}
            />
            <InputRow 
              label="Business Nature" 
              name="businessNature" 
              value={local.businessNature}
              onChange={e => onChange('businessNature', e.target.value)}
              disabled={!editing}
            />
            <InputRow
              label="Registration Number"
              name="registrationNumber"
              value={local.registrationNumber}
              onChange={e => onChange('registrationNumber', e.target.value)}
              disabled={!editing}
            />
            <InputRow
              label="Number of Directors"
              name="numberOfDirectors"
              type="number"
              value={local.numberOfDirectors}
              onChange={e => onChange('numberOfDirectors', e.target.value)}
              disabled={!editing}
            />
            <div className="lg:col-span-3">
              <label className="block text-xs text-gray-600 mb-1">
                Company Address
              </label>
              <textarea
                rows={2}
                className="w-full px-3 py-2 border rounded"
                value={local.companyAddress ?? ''}
                onChange={e =>
                  onChange('companyAddress', e.target.value)
                }
                disabled={!editing}
              />
            </div>
            <InputRow 
              label="Mobile" 
              name="mobile" 
              value={local.mobile}
              onChange={e => onChange('mobile', e.target.value)}
              disabled={!editing}
            />
            <InputRow 
              label="Landline" 
              name="landline" 
              value={local.landline}
              onChange={e => onChange('landline', e.target.value)}
              disabled={!editing}
            />
            <InputRow 
              label="Email" 
              name="email" 
              type="email" 
              value={local.email}
              onChange={e => onChange('email', e.target.value)}
              disabled={!editing}
            />
            <InputRow 
              label="Website" 
              name="website" 
              type="url" 
              value={local.website}
              onChange={e => onChange('website', e.target.value)}
              disabled={!editing}
            />
          </div>
          {/* Directors / Owners */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <InputRow
              label="Director/Owner 1 - Name"
              name="directorOwnerName1"
              value={local.directorOwnerName1}
              onChange={e => onChange('directorOwnerName1', e.target.value)}
              disabled={!editing}
            />
            <InputRow 
              label="Position 1" 
              name="position1" 
              value={local.position1}
              onChange={e => onChange('position1', e.target.value)}
              disabled={!editing}
            />
            <InputRow
              label="Nationality 1"
              name="nationality1"
              value={local.nationality1}
              onChange={e => onChange('nationality1', e.target.value)}
              disabled={!editing}
            />
            <InputRow
              label="Director/Owner 1 - Home Address"
              name="homeAddress1"
              rows={2}
              value={local.homeAddress1}
              onChange={e => onChange('homeAddress1', e.target.value)}
              disabled={!editing}
            />
            <InputRow
              label="DOB 1"
              name="dob1_local"
              type="date"
              value={local.dob1_local}
              onChange={e => onChange('dob1_local', e.target.value)}
              disabled={!editing}
            />
            <InputRow
              label="Director/Owner 2 - Name"
              name="directorOwnerName2"
              value={local.directorOwnerName2}
              onChange={e => onChange('directorOwnerName2', e.target.value)}
              disabled={!editing}
            />
            <InputRow 
              label="Position 2" 
              name="position2" 
              value={local.position2}
              onChange={e => onChange('position2', e.target.value)}
              disabled={!editing}
            />
            <InputRow
              label="DOB 2"
              name="dob2_local"
              type="date"
              value={local.dob2_local}
              onChange={e => onChange('dob2_local', e.target.value)}
              disabled={!editing}
            />
            <InputRow
              label="Director/Owner 2 - Home Address"
              name="homeAddress2"
              rows={2}
              value={local.homeAddress2}
              onChange={e => onChange('homeAddress2', e.target.value)}
              disabled={!editing}
            />
            <InputRow
              label="Nationality 2"
              name="nationality2"
              value={local.nationality2}
              onChange={e => onChange('nationality2', e.target.value)}
              disabled={!editing}
            />
          </div>
          {/* Payment Processing & Banking */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <InputRow 
              label="Offered Company" 
              name="offeredCompany" 
              value={local.offeredCompany}
              onChange={e => onChange('offeredCompany', e.target.value)}
              disabled={!editing}
            />
            <InputRow 
              label="Offered Terms" 
              name="offeredTerms" 
              value={local.offeredTerms}
              onChange={e => onChange('offeredTerms', e.target.value)}
              disabled={!editing}
            />
            <InputRow
              label="Existing Company"
              name="existingCompany"
              value={local.existingCompany}
              onChange={e => onChange('existingCompany', e.target.value)}
              disabled={!editing}
            />
            <InputRow
              label="Remaining Terms"
              name="remainingTerms"
              value={local.remainingTerms}
              onChange={e => onChange('remainingTerms', e.target.value)}
              disabled={!editing}
            />
            <InputRow
              label="Already Paying Charges"
              name="alreadyPayingCharges"
              value={local.alreadyPayingCharges}
              onChange={e => onChange('alreadyPayingCharges', e.target.value)}
              disabled={!editing}
            />
            <InputRow 
              label="Details" 
              name="details" 
              rows={2} 
              value={local.details}
              onChange={e => onChange('details', e.target.value)}
              disabled={!editing}
            />
            <InputRow
              label="Total Turnover"
              name="totalTurnover"
              type="number"
              value={local.totalTurnover}
              onChange={e => onChange('totalTurnover', e.target.value)}
              disabled={!editing}
            />
            <InputRow
              label="Card Turnover"
              name="cardTurnover"
              type="number"
              value={local.cardTurnover}
              onChange={e => onChange('cardTurnover', e.target.value)}
              disabled={!editing}
            />
            <InputRow
              label="Avg Transaction"
              name="avgTransaction"
              type="number"
              value={local.avgTransaction}
              onChange={e => onChange('avgTransaction', e.target.value)}
              disabled={!editing}
            />
            <InputRow
              label="Min Transaction"
              name="minTransaction"
              type="number"
              value={local.minTransaction}
              onChange={e => onChange('minTransaction', e.target.value)}
              disabled={!editing}
            />
            <InputRow
              label="Max Transaction"
              name="maxTransaction"
              type="number"
              value={local.maxTransaction}
              onChange={e => onChange('maxTransaction', e.target.value)}
              disabled={!editing}
            />
            <InputRow
              label="Monthly Line Rent"
              name="monthlyLineRent"
              type="number"
              value={local.monthlyLineRent}
              onChange={e => onChange('monthlyLineRent', e.target.value)}
              disabled={!editing}
            />
            <InputRow
              label="Debit Percentage"
              name="debitPercentage"
              type="number"
              value={local.debitPercentage}
              onChange={e => onChange('debitPercentage', e.target.value)}
              disabled={!editing}
            />
            <InputRow
              label="Credit Percentage"
              name="creditPercentage"
              type="number"
              value={local.creditPercentage}
              onChange={e => onChange('creditPercentage', e.target.value)}
              disabled={!editing}
            />
            <InputRow
              label="Authorization Fee"
              name="authorizationFee"
              type="number"
              value={local.authorizationFee}
              onChange={e => onChange('authorizationFee', e.target.value)}
              disabled={!editing}
            />
            <InputRow 
              label="Other Cards" 
              name="otherCards" 
              value={local.otherCards}
              onChange={e => onChange('otherCards', e.target.value)}
              disabled={!editing}
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <InputRow 
              label="Account Title" 
              name="accountTitle" 
              value={local.accountTitle}
              onChange={e => onChange('accountTitle', e.target.value)}
              disabled={!editing}
            />
            <InputRow 
              label="Bank Name" 
              name="bankName" 
              value={local.bankName}
              onChange={e => onChange('bankName', e.target.value)}
              disabled={!editing}
            />
            <InputRow
              label="Account Number"
              name="accountNumber"
              value={local.accountNumber}
              onChange={e => onChange('accountNumber', e.target.value)}
              disabled={!editing}
            />
            <InputRow 
              label="Sort Code" 
              name="sortCode" 
              value={local.sortCode}
              onChange={e => onChange('sortCode', e.target.value)}
              disabled={!editing}
            />
            <InputRow 
              label="IBAN" 
              name="iban" 
              value={local.iban}
              onChange={e => onChange('iban', e.target.value)}
              disabled={!editing}
            />
          </div>
          {/* Lead Management */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Status
              </label>
              <select
                className="w-full px-3 py-2 border rounded"
                value={local.status ?? 'lead'}
                onChange={e => onChange('status', e.target.value)}
                disabled={!editing}
              >
                <option value="lead">lead</option>
                <option value="callback">callback</option>
                <option value="sale">sale</option>
                <option value="transfer">transfer</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Due Date &amp; Time
              </label>
              <ReactDatePicker
                selected={local.dueDate_date}
                onChange={date => onChange('dueDate_date', date)}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                dateFormat="yyyy-MM-dd HH:mm"
                className="w-full px-3 py-2 border rounded"
                placeholderText="Select date and time"
                disabled={!editing}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Tags
              </label>
              <input
                className="w-full px-3 py-2 border rounded"
                type="text"
                value={local.tagsText ?? ''}
                onChange={e => onChange('tagsText', e.target.value)}
                disabled={!editing}
                placeholder="comma, separated, tags"
              />
              <div className="text-xs text-gray-500 mt-1">
                Comma separated tags.
              </div>
            </div>
            <div className="lg:col-span-3">
              <label className="block text-xs text-gray-600 mb-1">
                Lead Comment (initial/summary)
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 border rounded"
                value={local.leadComment ?? ''}
                onChange={e =>
                  onChange('leadComment', e.target.value)
                }
                disabled={!editing}
              />
              <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                <div>
                  Last comment date:{' '}
                  {local.leadCommentDate
                    ? new Date(
                        local.leadCommentDate
                      ).toLocaleString()
                    : '—'}
                </div>
                <div className="text-right">
                  You can also add comment entries below
                </div>
              </div>
            </div>
          </div>
          {/* Assignment */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Assigned To
              </label>
              <select
                className="w-full px-3 py-2 border rounded"
                value={local.assignedToId || ''}
                onChange={e => {
                  const newAssignedToId = e.target.value ? parseInt(e.target.value, 10) : null;
                  if (
                    userRole === 'admin' ||
                    userRole === 'team_lead' ||
                    userRole === 'Team Lead'
                  ) {
                    handleAssign(newAssignedToId);
                  } else {
                    onChange('assignedToId', newAssignedToId);
                  }
                }}
                disabled={!editing}
              >
                <option value="">Select user...</option>
                {assignableUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {u.team
                      ? ` — ${
                          typeof u.team === 'string'
                            ? u.team
                            : u.team.name
                        }`
                      : ''}
                    {typeof u.role === 'string'
                      ? ` (${u.role})`
                      : u.role?.name
                      ? ` (${u.role.name})`
                      : ''}
                  </option>
                ))}
              </select>
              <div className="text-xs text-gray-500 mt-1">
                {userRole === 'admin'
                  ? 'You can assign to any user'
                  : userRole === 'team_lead' ||
                    userRole === 'Team Lead'
                  ? 'You can assign to yourself or team members'
                  : 'You can assign to yourself or your team lead'}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Team Name
              </label>
              <input
                className="w-full px-3 py-2 border rounded"
                value={local.teamName ?? ''}
                onChange={e => onChange('teamName', e.target.value)}
                disabled={!editing}
              />
            </div>
          </div>
          {/* Status comment adders */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">
              Add Status Comments
            </h4>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <StatusCommentBox
                title="Lead Comment"
                existingComment={local.leadComment}
                existingDate={local.leadCommentDate}
                onAdd={text => handleAddStatusComment('lead', text)}
                disabled={!editing}
              />
              <StatusCommentBox
                title="Callback Comment"
                existingComment={local.callbackComment}
                existingDate={local.callbackCommentDate}
                onAdd={text =>
                  handleAddStatusComment('callback', text)
                }
                disabled={!editing}
              />
              <StatusCommentBox
                title="Sale Comment"
                existingComment={local.saleComment}
                existingDate={local.saleCommentDate}
                onAdd={text => handleAddStatusComment('sale', text)}
                disabled={!editing}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}