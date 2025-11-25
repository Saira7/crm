// src/components/LeadDetailModal.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { X, Save, Edit2 } from 'lucide-react';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export default function LeadDetailModal({
  lead,            // lead object from server
  token,           // auth token (apiFetch will use, kept for future use)
  user,            // current user (to get role/team/id)
  users = [],      // list of users to assign to (passed from parent)
  onClose,         // close modal
  onUpdate,        // callback to update lead
  onRefresh        // callback to reload data after updates
}) {
  const [local, setLocal] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changedFields, setChangedFields] = useState(new Set());

  // initialize local state when lead prop changes
  useEffect(() => {
    if (!lead) {
      setLocal(null);
      return;
    }
    // copy lead and convert arrays/dates into form-friendly values
    setLocal({
      ...lead,
      // convert tags array -> comma string
      tagsText: Array.isArray(lead.tags)
        ? lead.tags.join(', ')
        : (lead.tags || '').toString(),
      // Convert dueDate to Date object for the date picker
      dueDate_date: lead.dueDate ? new Date(lead.dueDate) : null,
      // Convert other dates for display
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
  const userTeam = user?.team
    ? (typeof user.team === 'string' ? user.team : user.team.name)
    : null;

  // users available to assign depending on role
  const assignableUsers = useMemo(() => {
    if (!users) return [];

    if (userRole === 'admin') {
      // Admin can see and assign to anyone
      return users;
    } else if (userRole === 'team_lead' || userRole === 'Team Lead') {
      // Team lead can assign to themselves or team members in same team
      return users.filter(u => {
        const uTeam =
          typeof u.team === 'string' ? u.team : u.team?.name;
        return uTeam === userTeam;
      });
    } else {
      // Regular sales rep can only assign to themselves or their team lead in same team
      return users.filter(u => {
        const uTeam =
          typeof u.team === 'string' ? u.team : u.team?.name;
        const uRole =
          typeof u.role === 'string' ? u.role : u.role?.name;

        return (
          u.id === user.id ||
          ((uRole === 'team_lead' || uRole === 'Team Lead') &&
            uTeam === userTeam)
        );
      });
    }
  }, [users, userRole, userTeam, user?.id]);

  if (!local) return null;

  // Field change handler (keeps changedFields set)
  const onChange = (field, value) => {
    setLocal(prev => ({ ...prev, [field]: value }));
    setChangedFields(prev => new Set([...prev]).add(field));
  };

  // Build patch object only with changed fields mapped to DB schema
  const buildPatch = () => {
    const patch = {};
    for (const f of changedFields) {
      switch (f) {
        // fields where local stores different auxiliary property names
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
          // assume other fields map directly to DB property names
          patch[f] = local[f] === '' ? null : local[f];
      }
    }
    return patch;
  };

  // Save changed fields to server
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

  // Add a status comment (lead/callback/sale/transfer) - stores comment and comment date
  const handleAddStatusComment = async (statusKey, commentText) => {
    if (!commentText || !commentText.trim()) {
      alert('Please add a comment.');
      return;
    }
    const commentField = `${statusKey}Comment`; // e.g., leadComment
    const dateField = `${statusKey}CommentDate`; // e.g., leadCommentDate
    const payload = {
      [commentField]: commentText,
      [dateField]: new Date().toISOString(),
    };
    setSaving(true);
    try {
      await onUpdate(local.id, payload);
      // update local copy so UI reflects immediately
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

  // Assign to user (admin or team_lead)
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

  // Render helper: a controlled input row
  const InputRow = ({
    label,
    name,
    type = 'text',
    placeholder = '',
    className = '',
    rows = 1,
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
            value={local[name] ?? ''}
            placeholder={placeholder}
            onChange={e => onChange(name, e.target.value)}
            disabled={!editing}
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
          value={local[name] ?? ''}
          placeholder={placeholder}
          onChange={e => onChange(name, e.target.value)}
          disabled={!editing}
        />
      </div>
    );
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
            <InputRow label="Customer Name" name="companyName" />
            <InputRow label="Company Type" name="companyType" />
            <InputRow label="Trading Name" name="tradingName" />

            <InputRow label="Business Nature" name="businessNature" />
            <InputRow
              label="Registration Number"
              name="registrationNumber"
            />
            <InputRow
              label="Number of Directors"
              name="numberOfDirectors"
              type="number"
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

            <InputRow label="Mobile" name="mobile" />
            <InputRow label="Landline" name="landline" />
            <InputRow label="Email" name="email" type="email" />
            <InputRow label="Website" name="website" type="url" />
          </div>

          {/* Directors / Owners */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <InputRow
              label="Director/Owner 1 - Name"
              name="directorOwnerName1"
            />
            <InputRow label="Position 1" name="position1" />
            <InputRow
              label="Nationality 1"
              name="nationality1"
            />

            <InputRow
              label="Director/Owner 1 - Home Address"
              name="homeAddress1"
              rows={2}
            />

            <InputRow
              label="DOB 1"
              name="dob1_local"
              type="date"
            />
            <InputRow
              label="Director/Owner 2 - Name"
              name="directorOwnerName2"
            />
            <InputRow label="Position 2" name="position2" />

            <InputRow
              label="DOB 2"
              name="dob2_local"
              type="date"
            />
            <InputRow
              label="Director/Owner 2 - Home Address"
              name="homeAddress2"
              rows={2}
            />
            <InputRow
              label="Nationality 2"
              name="nationality2"
            />
          </div>

          {/* Payment Processing & Banking */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <InputRow label="Offered Company" name="offeredCompany" />
            <InputRow label="Offered Terms" name="offeredTerms" />
            <InputRow
              label="Existing Company"
              name="existingCompany"
            />
            <InputRow
              label="Remaining Terms"
              name="remainingTerms"
            />
            <InputRow
              label="Already Paying Charges"
              name="alreadyPayingCharges"
            />
            <InputRow label="Details" name="details" rows={2} />

            <InputRow
              label="Total Turnover"
              name="totalTurnover"
              type="number"
            />
            <InputRow
              label="Card Turnover"
              name="cardTurnover"
              type="number"
            />
            <InputRow
              label="Avg Transaction"
              name="avgTransaction"
              type="number"
            />
            <InputRow
              label="Min Transaction"
              name="minTransaction"
              type="number"
            />
            <InputRow
              label="Max Transaction"
              name="maxTransaction"
              type="number"
            />
            <InputRow
              label="Monthly Line Rent"
              name="monthlyLineRent"
              type="number"
            />
            <InputRow
              label="Debit Percentage"
              name="debitPercentage"
              type="number"
            />
            <InputRow
              label="Credit Percentage"
              name="creditPercentage"
              type="number"
            />
            <InputRow
              label="Authorization Fee"
              name="authorizationFee"
              type="number"
            />
            <InputRow label="Other Cards" name="otherCards" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <InputRow label="Account Title" name="accountTitle" />
            <InputRow label="Bank Name" name="bankName" />
            <InputRow
              label="Account Number"
              name="accountNumber"
            />
            <InputRow label="Sort Code" name="sortCode" />
            <InputRow label="IBAN" name="iban" />
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
                value={local.assignedToId || user.id}
                onChange={e => {
                  const newAssignedToId = parseInt(e.target.value, 10);
                  onChange('assignedToId', newAssignedToId);
                  if (
                    userRole === 'admin' ||
                    userRole === 'team_lead' ||
                    userRole === 'Team Lead'
                  ) {
                    handleAssign(newAssignedToId);
                  }
                }}
                disabled={!editing}
              >
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

/** Small sub-component for status comment boxes */
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
