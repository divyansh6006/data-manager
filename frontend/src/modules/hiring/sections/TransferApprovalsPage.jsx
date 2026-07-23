import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../../../shared/components/Modal';
import DataTable from '../../../shared/components/DataTable';
import { MaskedPhone, MaskedEmail } from '../../../shared/components/MaskedContact';
import { hiringApi } from '../services/hiringApi';

// Queue of "give up" transfer requests recruiters submit on a candidate (see
// FollowUpTransferShim in CandidatesPage.jsx) — a team leader/super_admin reviews each one
// and either approves it onto a specific recruiter on their team, or rejects it outright.
export default function TransferApprovalsPage({ token, showToast }) {
  const [requests, setRequests] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approveTarget, setApproveTarget] = useState(null); // the request being approved
  const [targetRecruiterId, setTargetRecruiterId] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reqData, recruiterData] = await Promise.all([
        hiringApi.listTransferRequests(token),
        hiringApi.listRecruiters(token)
      ]);
      setRequests(reqData);
      setRecruiters(recruiterData);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Live polling so a newly-submitted request shows up without a manual refresh, mirroring
  // the Admissions Team Leader's Transfer Approvals tab.
  useEffect(() => {
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load]);

  const openApprove = (req) => {
    setApproveTarget(req);
    setTargetRecruiterId('');
    setError(null);
  };

  const handleApprove = async (e) => {
    e.preventDefault();
    if (!targetRecruiterId) { setError('Select a recruiter to receive this candidate.'); return; }
    setSaving(true);
    setError(null);
    try {
      await hiringApi.approveTransfer(token, approveTarget.id, { targetRecruiterId });
      showToast('Transfer approved.', 'success');
      setApproveTarget(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (req) => {
    if (!window.confirm(`Reject the transfer request for ${req.candidate_name}?`)) return;
    try {
      await hiringApi.rejectTransfer(token, req.id);
      showToast('Transfer rejected.', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const columns = [
    { key: 'candidate_name', label: 'Candidate', render: (r) => (
      <div>
        <div className="font-semibold">{r.candidate_name}</div>
        <div className="text-[10px] text-slate-400"><MaskedPhone phone={r.candidate_phone} /></div>
        <div className="text-[10px] text-slate-400"><MaskedEmail email={r.candidate_email} /></div>
      </div>
    ) },
    { key: 'requested_by_name', label: 'Requested By' },
    { key: 'reason', label: 'Reason' },
    { key: 'note', label: 'Note', render: (r) => r.note || <span className="text-slate-400">—</span> },
    { key: 'created_at', label: 'Requested At', render: (r) => new Date(r.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) },
    { key: 'actions', label: '', className: 'text-right', render: (r) => (
      <div className="flex items-center justify-end gap-2">
        <button onClick={() => handleReject(r)} className="text-[10px] font-bold py-1 px-2.5 rounded bg-red-50 border border-red-200 text-red-700 hover:bg-red-100">
          Reject
        </button>
        <button onClick={() => openApprove(r)} className="text-[10px] font-bold py-1 px-2.5 rounded bg-[#7C3AED] hover:bg-[#6D28D9] text-white">
          Approve
        </button>
      </div>
    ) }
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#E2E8F0] dark:border-slate-700 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#111C2D] dark:text-white font-label-caps">Pending Transfer Requests</span>
          <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 py-0.5 px-2 rounded-full font-bold">{requests.length}</span>
        </div>
        <DataTable columns={columns} rows={requests} loading={loading} emptyMessage="No pending transfer requests." />
      </div>

      {approveTarget && (
        <Modal title={`Approve Transfer — ${approveTarget.candidate_name}`} icon="swap_horiz" onClose={() => setApproveTarget(null)} maxWidth="max-w-sm"
          footer={(
            <>
              <button type="button" onClick={() => setApproveTarget(null)} className="py-1.5 px-3 border border-[#CBD5E1] text-xs font-semibold rounded">Cancel</button>
              <button form="approve-transfer-form" type="submit" disabled={saving} className="py-1.5 px-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold rounded disabled:opacity-50">
                {saving ? 'Approving...' : 'Approve'}
              </button>
            </>
          )}
        >
          {error && <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded">{error}</div>}
          <form id="approve-transfer-form" onSubmit={handleApprove} className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Requested by <strong>{approveTarget.requested_by_name}</strong> — {approveTarget.reason}
              {approveTarget.note ? `: ${approveTarget.note}` : ''}
            </p>
            <div>
              <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Reassign To</label>
              <select value={targetRecruiterId} onChange={(e) => setTargetRecruiterId(e.target.value)} className="w-full text-xs p-2 bg-[#F9F9FF] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 dark:text-white rounded">
                <option value="">-- Select Recruiter --</option>
                {recruiters.map(r => <option key={r.id} value={r.id}>{r.name} ({r.load} active)</option>)}
              </select>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
