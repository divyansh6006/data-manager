import React, { useState, useEffect, useCallback } from 'react';
import DataTable from '../../../shared/components/DataTable';
import StatusBadge from '../../../shared/components/StatusBadge';
import { MaskedPhone, MaskedEmail } from '../../../shared/components/MaskedContact';
import { hiringApi } from '../services/hiringApi';
import InterviewUpdateModal from '../components/InterviewUpdateModal';

const STATUS_STYLES = {
  Scheduled: { color: '#7C3AED', dot: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700 border border-violet-200' },
  Completed: { color: '#16A34A', dot: 'bg-green-600', badge: 'bg-green-50 text-green-700 border border-green-200' },
  Cancelled: { color: '#DC2626', dot: 'bg-red-600', badge: 'bg-red-50 text-red-700 border border-red-200' },
  'No-show': { color: '#D97706', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border border-amber-200' }
};

// Dedicated Interview Schedule view — a plain filterable list (Admissions-style: pill
// tabs above a table), not a board. Replaces looking up interviews one candidate at a
// time in the drawer; the "Upcoming"/"All" pills reuse GET /interviews?upcoming=true vs
// the unfiltered GET /interviews already built (and previously unused) for this purpose.
export default function InterviewsPage({ token, showToast }) {
  const [tab, setTab] = useState('upcoming'); // 'upcoming' | 'all'
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { interview }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hiringApi.listInterviews(token, tab === 'upcoming');
      setInterviews(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [token, tab]);

  useEffect(() => { load(); }, [load]);

  const handleUpdate = async (body) => {
    await hiringApi.updateInterview(token, modal.interview.id, body);
    showToast('Interview updated.', 'success');
    setModal(null);
    load();
  };

  const columns = [
    { key: 'candidate_name', label: 'Candidate', render: (r) => (
      <div>
        <div className="font-semibold">{r.candidate_name}</div>
        <div className="text-[10px] text-slate-400"><MaskedPhone phone={r.candidate_phone} /></div>
        <div className="text-[10px] text-slate-400"><MaskedEmail email={r.candidate_email} /></div>
      </div>
    ) },
    { key: 'company_name', label: 'Company', render: (r) => r.company_name || '—' },
    { key: 'round', label: 'Round', render: (r) => r.round || '—' },
    { key: 'scheduled_date', label: 'Date', render: (r) => (
      <div>
        <div className="font-data-mono">{r.scheduled_date}</div>
        {r.scheduled_time && <div className="text-[10px] text-slate-400 font-data-mono">{r.scheduled_time}</div>}
      </div>
    ) },
    { key: 'mode', label: 'Mode', render: (r) => r.mode || '—' },
    { key: 'interviewer', label: 'Interviewer', render: (r) => r.interviewer || '—' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} styleMap={STATUS_STYLES} showDot /> },
    { key: 'result', label: 'Result', render: (r) => r.result || '—' },
    { key: 'actions', label: '', render: (r) => (
      <button onClick={(e) => { e.stopPropagation(); setModal({ interview: r }); }} className="text-[10px] font-bold py-1 px-2.5 rounded bg-[#7C3AED] text-white hover:bg-[#6D28D9]">
        Update
      </button>
    ) }
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab('upcoming')}
            className={`text-[10px] font-bold uppercase tracking-wider py-1.5 px-3 rounded-md font-label-caps ${tab === 'upcoming' ? 'bg-white dark:bg-slate-700 text-[#7C3AED] shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setTab('all')}
            className={`text-[10px] font-bold uppercase tracking-wider py-1.5 px-3 rounded-md font-label-caps ${tab === 'all' ? 'bg-white dark:bg-slate-700 text-[#7C3AED] shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
          >
            All Interviews
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          rows={interviews}
          loading={loading}
          emptyMessage={tab === 'upcoming' ? 'No upcoming interviews scheduled.' : 'No interviews found.'}
        />
      </div>

      {modal && <InterviewUpdateModal interview={modal.interview} onClose={() => setModal(null)} onSubmit={handleUpdate} />}
    </div>
  );
}
