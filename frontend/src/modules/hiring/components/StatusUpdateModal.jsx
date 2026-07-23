import React, { useState } from 'react';
import Modal from '../../../shared/components/Modal';
import { HIRING_STATUSES, TERMINAL_HIRING_STATUSES, getPipelineStyle, REGISTRATION_STATUSES, NOT_CONTACTABLE_REASONS } from '../constants/pipeline';

// These stay valid pipeline_status values (still shown as badges/filters) but aren't
// offered as manual picks in this dropdown, to keep the day-to-day status-update list short
// and focused on what a recruiter actually chooses between call to call. Interview
// Scheduled is a plain pick here (moves the candidate into that category, no interview
// record/date required) — Interview Completed/Selected/Rejected/Offer Released/Joined/
// Closed/Contacted are handled elsewhere (or reached historically).
const DROPDOWN_HIDDEN_STATUSES = ['Contacted', 'Interview Completed', 'Selected', 'Rejected', 'Offer Released', 'Joined', 'Closed'];

export default function StatusUpdateModal({ candidate, onClose, onSubmit }) {
  const [status, setStatus] = useState(candidate.pipeline_status || 'New');
  const [registrationStatus, setRegistrationStatus] = useState(candidate.registration_status || 'Pending');
  const [notContactableReason, setNotContactableReason] = useState(candidate.not_contactable_reason || NOT_CONTACTABLE_REASONS[0]);
  const [followUpDate, setFollowUpDate] = useState('');
  const [remark, setRemark] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const isTerminal = TERMINAL_HIRING_STATUSES.includes(status);
  // Always keep the candidate's current status selectable even if it's normally hidden —
  // otherwise the dropdown would show blank for a candidate already sitting at, say,
  // Interview Scheduled (reached through a different path, not this list).
  const dropdownStatuses = HIRING_STATUSES.filter(s => !DROPDOWN_HIDDEN_STATUSES.includes(s) || s === candidate.pipeline_status);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!remark.trim()) { setError('A remark is required to update the status.'); return; }
    if (status === 'Call Back' && !followUpDate) { setError('Please pick a callback date/time.'); return; }
    setSaving(true);
    try {
      await onSubmit({ status, remark, registrationStatus, notContactableReason, followUpDate });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Update Status — ${candidate.name}`} icon="edit" onClose={onClose} maxWidth="max-w-sm"
      footer={(
        <>
          <button type="button" onClick={onClose} className="py-1.5 px-3 border border-[#CBD5E1] text-xs font-semibold rounded">Cancel</button>
          <button form="status-form" type="submit" disabled={saving} className="py-1.5 px-4 text-white text-xs font-semibold rounded disabled:opacity-50" style={{ background: getPipelineStyle(status).color }}>
            {saving ? 'Saving...' : 'Save Status'}
          </button>
        </>
      )}
    >
      {error && <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded">{error}</div>}
      <form id="status-form" onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full text-xs p-2 bg-[#F9F9FF] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 dark:text-white rounded font-semibold" style={{ color: getPipelineStyle(status).color }}>
            {dropdownStatuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {isTerminal && (
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800 font-semibold flex items-start gap-1.5">
            <span className="material-symbols-outlined text-sm">info</span>
            <span>This will close out the candidate and remove them from the active pipeline.</span>
          </div>
        )}

        {status === 'Not Contactable' && (
          <div>
            <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Reason</label>
            <select value={notContactableReason} onChange={(e) => setNotContactableReason(e.target.value)} className="w-full text-xs p-2 bg-[#F9F9FF] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 dark:text-white rounded">
              {NOT_CONTACTABLE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        )}

        {status === 'Call Back' && (
          <div>
            <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Call Back Date/Time <span className="text-[#BA1A1A]">*</span></label>
            <input
              type="datetime-local"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className={`w-full text-xs p-2 bg-[#F9F9FF] dark:bg-slate-900 border rounded dark:text-white ${error && !followUpDate ? 'border-[#BA1A1A]' : 'border-[#CBD5E1] dark:border-slate-700'}`}
            />
            <p className="text-[10px] text-slate-400 mt-1">This automatically schedules a follow-up — no separate action needed.</p>
          </div>
        )}

        {status === 'Registration Pending' || status === 'Registration Completed' ? (
          <div>
            <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Registration</label>
            <select value={registrationStatus} onChange={(e) => setRegistrationStatus(e.target.value)} className="w-full text-xs p-2 bg-[#F9F9FF] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 dark:text-white rounded">
              {REGISTRATION_STATUSES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        ) : null}

        <div>
          <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Remark <span className="text-[#BA1A1A]">*</span></label>
          <textarea value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Add context from the call — this is mandatory..." className={`w-full text-xs p-2 bg-[#F9F9FF] dark:bg-slate-900 border rounded h-20 dark:text-white ${error && !remark.trim() ? 'border-[#BA1A1A]' : 'border-[#CBD5E1] dark:border-slate-700'}`} />
        </div>
      </form>
    </Modal>
  );
}
