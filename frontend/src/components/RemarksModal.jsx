import React, { useState, useEffect } from 'react';

// Shared "view remarks history" panel — every dashboard (Counselor, Manager, Team
// Leader) opens this the same way, since a lead can accumulate several remarks over
// time (status changes, call notes, registration/fee updates, forwards) and the live
// lead_assignments.status_remark column only ever holds the latest one.
export default function RemarksModal({ token, lead, onClose }) {
  const [remarks, setRemarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/leads/${lead.id}/remarks`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch remarks');
        if (!cancelled) setRemarks(data);
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [lead.id, token]);

  const ACTION_LABELS = {
    status_change: 'Status Change',
    note: 'Call Note',
    registration_update: 'Registration',
    fee_update: 'Fee Payment',
    forward_to_manager: 'Escalated',
    forward_resolved_send_back: 'Escalation Resolved',
    forward_resolved_reassign: 'Reassigned',
    tick: 'Enrolled',
    cross: 'Closed',
    distributed: 'Allocated',
    call: 'Call Logged',
    transfer_request: 'Transfer Requested',
    transfer_approve: 'Transfer Approved',
    transfer_reject: 'Transfer Rejected'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
      <div className="w-full max-w-lg bg-white border border-[#CBD5E1] rounded shadow-lg animate-in fade-in zoom-in-95 duration-150 max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-[#CBD5E1] flex items-center justify-between shrink-0">
          <h3 className="text-sm font-bold text-[#111C2D] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#1BACE4]">forum</span>
            <span>Remarks History — {lead.name}</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3">
          {loading && <div className="text-center text-xs text-slate-400 italic py-6">Loading remarks...</div>}
          {error && <div className="text-center text-xs text-red-500 py-6">{error}</div>}
          {!loading && !error && remarks.length === 0 && (
            <div className="text-center text-xs text-slate-400 italic py-6">No remarks recorded for this lead yet.</div>
          )}
          {!loading && !error && remarks.map((r) => (
            <div key={r.id} className="border border-slate-200 rounded p-3 bg-slate-50">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#1BACE4] bg-[#E6F8FE] px-1.5 py-0.5 rounded">
                  {ACTION_LABELS[r.action] || r.action}
                </span>
                <span className="text-[10px] text-slate-400 font-data-mono">
                  {new Date(r.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-snug whitespace-pre-wrap">{r.remark}</p>
              <p className="text-[10px] text-slate-400 mt-1">by {r.counselor_name}</p>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-[#CBD5E1] flex justify-end shrink-0">
          <button onClick={onClose} className="py-1.5 px-3 border border-[#CBD5E1] text-xs font-semibold rounded">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
