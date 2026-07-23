import React, { useState, useEffect } from 'react';
import { hiringApi } from '../services/hiringApi';

const ACTION_LABELS = {
  status_change: 'Status Change',
  note: 'Note',
  call: 'Call Logged',
  assign: 'Assigned',
  interview_scheduled: 'Interview Scheduled',
  interview_completed: 'Interview Completed',
  follow_up: 'Follow-up Scheduled',
  transfer_request: 'Transfer Requested',
  transfer_approve: 'Transfer Approved',
  transfer_reject: 'Transfer Rejected'
};

// Simple "view activity history" popup — mirrors Admissions' RemarksModal exactly (same
// shell, same one-job scope: show what happened and when, nothing else). Replaces the old
// full candidate-detail side drawer, which bundled remarks/info/actions into one big panel;
// all of that other info now just lives directly in the Candidates table columns instead.
export default function CandidateActivityModal({ token, candidate, onClose }) {
  const [remarks, setRemarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    hiringApi.getRemarks(token, candidate.id)
      .then((data) => { if (!cancelled) setRemarks(data); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [candidate.id, token]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded shadow-lg animate-fade-in max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-[#CBD5E1] dark:border-slate-700 flex items-center justify-between shrink-0">
          <h3 className="text-sm font-bold text-[#111C2D] dark:text-white flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#7C3AED]">forum</span>
            <span>Activity History — {candidate.name}</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3">
          {loading && <div className="text-center text-xs text-slate-400 italic py-6">Loading activity...</div>}
          {error && <div className="text-center text-xs text-red-500 py-6">{error}</div>}
          {!loading && !error && remarks.length === 0 && (
            <div className="text-center text-xs text-slate-400 italic py-6">No activity recorded for this candidate yet.</div>
          )}
          {!loading && !error && remarks.map((r) => (
            <div key={r.id} className="border border-slate-200 dark:border-slate-700 rounded p-3 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#7C3AED] bg-violet-50 dark:bg-violet-950/40 px-1.5 py-0.5 rounded">
                  {ACTION_LABELS[r.action] || r.action}
                </span>
                <span className="text-[10px] text-slate-400 font-data-mono">
                  {new Date(r.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug whitespace-pre-wrap">{r.remark}</p>
              <p className="text-[10px] text-slate-400 mt-1">by {r.recruiter_name || '—'}</p>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-[#CBD5E1] dark:border-slate-700 flex justify-end shrink-0">
          <button onClick={onClose} className="py-1.5 px-3 border border-[#CBD5E1] dark:border-slate-700 dark:text-slate-300 text-xs font-semibold rounded">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
