import React, { useState, useEffect, useCallback, useRef } from 'react';
import DataTable from '../../../shared/components/DataTable';
import StatusBadge from '../../../shared/components/StatusBadge';
import StatCard from '../../../shared/components/StatCard';
import { MaskedPhone, MaskedEmail } from '../../../shared/components/MaskedContact';
import { hiringApi } from '../services/hiringApi';
import { getPipelineStyle, HIRING_STATUSES, TERMINAL_HIRING_STATUSES } from '../constants/pipeline';

const ACTIVE_STATUSES = HIRING_STATUSES.filter(s => !TERMINAL_HIRING_STATUSES.includes(s));
const CLOSED_STYLE = getPipelineStyle('Closed');

// Date-scoped view of what happened to which candidates on a given IST calendar day —
// the Hiring equivalent of GET /api/leads/daily-tracking (Leads workspace). Bucketed
// dynamically by whatever pipeline_status values actually occur, rather than a hardcoded
// leads-style category list, since Hiring has 11 active statuses vs Leads' 6.
export default function DailyTrackerPage({ token, showToast }) {
  const [date, setDate] = useState(''); // '' = let the backend resolve "today" (IST) on first load
  const [recruiterId, setRecruiterId] = useState('');
  const [recruiters, setRecruiters] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    hiringApi.listRecruiters(token).then(setRecruiters).catch(() => {});
  }, [token]);

  // Stale-response guard — mirrors the requestId ref pattern in DashboardHome.jsx/
  // CandidatesPage.jsx: switching the date quickly shouldn't let an older, slower response
  // land after a newer one and silently show the wrong day's data.
  const requestId = useRef(0);

  const fetchTracking = useCallback(async (targetDate) => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const result = await hiringApi.getDailyTracking(token, { date: targetDate || undefined, recruiterId: recruiterId || undefined });
      if (id !== requestId.current) return;
      setData(result);
      setDate(result.date);
      setCategory('all');
      setSearch('');
    } catch (err) {
      if (id !== requestId.current) return;
      showToast(err.message, 'error');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [token, recruiterId, showToast]);

  useEffect(() => { fetchTracking(date); }, [recruiterId]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = data?.categories?.[category] || [];
  const filteredRows = search
    ? rows.filter(r => {
      const q = search.toLowerCase();
      return [r.name, r.phone, r.email, r.current_location, r.current_company, r.recruiter_name].some(v => v && String(v).toLowerCase().includes(q));
    })
    : rows;

  const columns = [
    { key: 'name', label: 'Candidate', render: (r) => (
      <div>
        <div className="font-semibold">{r.name}</div>
        <div className="text-[10px] text-slate-400">{r.source || '—'}</div>
      </div>
    ) },
    { key: 'phone', label: 'Phone', render: (r) => <MaskedPhone phone={r.phone} /> },
    { key: 'email', label: 'Email', render: (r) => <MaskedEmail email={r.email} /> },
    { key: 'current_location', label: 'Location' },
    { key: 'experience', label: 'Exp', render: (r) => r.experience != null ? `${r.experience} yrs` : '—' },
    { key: 'current_company', label: 'Current Co.' },
    { key: 'recruiter_name', label: 'Recruiter', render: (r) => r.recruiter_name || '—' },
    { key: 'status', label: 'Status', render: (r) => {
      const status = r.pipeline_status || r.final_status;
      return <StatusBadge status={status} styleMap={{ [status]: getPipelineStyle(status) }} />;
    } },
    { key: 'activity', label: "Today's Activity", render: (r) => {
      const acts = r.activity_today || [];
      if (acts.length === 0) return <span className="text-slate-400">—</span>;
      const shown = acts.slice(0, 2);
      return (
        <div className="space-y-0.5">
          {shown.map((a, i) => <div key={i} className="text-[10px]">{a.remark || a.action}</div>)}
          {acts.length > shown.length && <div className="text-[10px] text-slate-400">+{acts.length - shown.length} more</div>}
        </div>
      );
    } },
    { key: 'updated', label: 'Last Updated', render: (r) => {
      const ts = r.assignment_updated_at || r.closed_at;
      return ts ? new Date(ts).toLocaleString() : '—';
    } }
  ];

  const pills = data ? (() => {
    const allPill = { key: 'all', label: 'All', color: '#7C3AED', count: data.summary.total };
    const statusPills = ACTIVE_STATUSES
      .map(s => ({ key: s, label: s, color: getPipelineStyle(s).color, count: data.summary.byStatus[s] || 0 }))
      .sort((a, b) => b.count - a.count);
    const closedPill = { key: 'closed', label: 'Closed Today', color: CLOSED_STYLE.color, count: data.summary.closed };
    return [allPill, ...statusPills, closedPill];
  })() : [];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-xl shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#70787C] dark:text-slate-400 mb-1 font-label-caps">Date</label>
            <input
              type="date"
              value={date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              className="text-xs p-1.5 bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#70787C] dark:text-slate-400 mb-1 font-label-caps">Recruiter</label>
            <select value={recruiterId} onChange={(e) => setRecruiterId(e.target.value)} className="text-xs p-1.5 bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded">
              <option value="">All Recruiters</option>
              {recruiters.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <button
            onClick={() => fetchTracking(date)}
            className="self-end text-[10px] font-bold py-1.5 px-3 rounded bg-[#7C3AED] hover:bg-[#6D28D9] text-white flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">refresh</span> Load
          </button>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon="groups" label="Total Tracked" value={data.summary.total} accent="#7C3AED" />
          <StatCard icon="task_alt" label="Closed Today" value={data.summary.closed} accent={CLOSED_STYLE.color} />
          <StatCard icon="new_releases" label="New" value={data.summary.byStatus['New'] || 0} accent={getPipelineStyle('New').color} />
          <StatCard icon="event_available" label="Interview Scheduled" value={data.summary.byStatus['Interview Scheduled'] || 0} accent={getPipelineStyle('Interview Scheduled').color} />
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-xl shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-2">
          {pills.map(pill => {
            const active = category === pill.key;
            const isEmpty = pill.key !== 'all' && pill.count === 0;
            return (
              <button
                key={pill.key}
                onClick={() => setCategory(pill.key)}
                className={`flex flex-col items-center p-2.5 rounded-lg border-2 transition hover:shadow-sm bg-white dark:bg-slate-900 ${isEmpty ? 'opacity-40 hover:opacity-100' : ''}`}
                style={{ borderColor: active ? pill.color : 'transparent', background: active ? `${pill.color}11` : undefined }}
              >
                <span className="text-lg font-black font-data-mono" style={{ color: pill.color }}>{pill.count}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5 text-center leading-tight" style={{ color: pill.color }}>{pill.label}</span>
              </button>
            );
          })}
        </div>
        <input
          placeholder="Search name, phone, email, company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-xs p-1.5 w-full max-w-sm bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded"
        />
      </div>

      <div className="bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          rows={filteredRows}
          loading={loading}
          emptyMessage="No candidates had activity on this date."
        />
      </div>
    </div>
  );
}
