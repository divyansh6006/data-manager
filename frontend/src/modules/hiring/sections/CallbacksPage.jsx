import React, { useState, useEffect, useCallback } from 'react';
import DataTable from '../../../shared/components/DataTable';
import { MaskedPhone, MaskedEmail } from '../../../shared/components/MaskedContact';
import { hiringApi } from '../services/hiringApi';

// Dedicated Callbacks view — a plain filterable list (same shape as the Interview Schedule
// page) so a recruiter can see every call they've promised to make and exactly when, instead
// of having to remember it or dig through each candidate's activity history one by one.
export default function CallbacksPage({ token, showToast }) {
  const [tab, setTab] = useState('pending'); // 'pending' | 'all'
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hiringApi.listFollowUps(token, tab === 'pending' ? 'true' : undefined);
      setFollowUps(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [token, tab]);

  useEffect(() => { load(); }, [load]);

  const handleComplete = async (id) => {
    setCompletingId(id);
    try {
      await hiringApi.completeFollowUp(token, id);
      showToast('Callback marked complete.', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCompletingId(null);
    }
  };

  const now = Date.now();

  const columns = [
    { key: 'candidate_name', label: 'Candidate', render: (r) => (
      <div>
        <div className="font-semibold">{r.candidate_name}</div>
        <div className="text-[10px] text-slate-400"><MaskedPhone phone={r.candidate_phone} /></div>
        <div className="text-[10px] text-slate-400"><MaskedEmail email={r.candidate_email} /></div>
      </div>
    ) },
    { key: 'follow_up_date', label: 'Scheduled For', render: (r) => {
      const due = new Date(r.follow_up_date).getTime();
      const overdue = !r.completed && due < now;
      return (
        <div>
          <div className={`font-data-mono text-[11px] ${overdue ? 'text-red-600 font-bold' : ''}`}>
            {new Date(r.follow_up_date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
          {overdue && <div className="text-[10px] text-red-500 font-bold uppercase">Overdue</div>}
        </div>
      );
    } },
    { key: 'notes', label: 'Notes', render: (r) => r.notes || <span className="text-slate-400 italic">—</span> },
    { key: 'status', label: 'Status', render: (r) => (
      r.completed
        ? <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">Completed</span>
        : <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Pending</span>
    ) },
    { key: 'actions', label: '', className: 'text-right', render: (r) => (
      r.completed ? null : (
        <button
          onClick={() => handleComplete(r.id)}
          disabled={completingId === r.id}
          className="py-1 px-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded text-[10px] font-bold disabled:opacity-50"
        >
          {completingId === r.id ? 'Saving...' : 'Mark Done'}
        </button>
      )
    ) }
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab('pending')}
            className={`text-[10px] font-bold uppercase tracking-wider py-1.5 px-3 rounded-md font-label-caps ${tab === 'pending' ? 'bg-white dark:bg-slate-700 text-[#7C3AED] shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
          >
            Pending
          </button>
          <button
            onClick={() => setTab('all')}
            className={`text-[10px] font-bold uppercase tracking-wider py-1.5 px-3 rounded-md font-label-caps ${tab === 'all' ? 'bg-white dark:bg-slate-700 text-[#7C3AED] shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
          >
            All Callbacks
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          rows={followUps}
          loading={loading}
          emptyMessage={tab === 'pending' ? 'No pending callbacks scheduled.' : 'No callbacks found.'}
        />
      </div>
    </div>
  );
}
