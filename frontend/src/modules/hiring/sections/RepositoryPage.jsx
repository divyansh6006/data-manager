import React, { useState, useEffect, useCallback, useRef } from 'react';
import DataTable from '../../../shared/components/DataTable';
import StatusBadge from '../../../shared/components/StatusBadge';
import StatCard from '../../../shared/components/StatCard';
import { MaskedPhone, MaskedEmail } from '../../../shared/components/MaskedContact';
import { hiringApi } from '../services/hiringApi';
import { PIPELINE_STYLES, getPipelineStyle, HIRING_STATUSES } from '../constants/pipeline';
import CandidateActivityModal from '../components/CandidateActivityModal';

// Raw upload statuses that never get a pipeline_status/final_status at all — a candidate
// only reaches one of these if it was never assignable to begin with (see candidates.routes.js
// upload handler). Styled distinctly from pipeline statuses so a duplicate/invalid raw row is
// visually obvious rather than looking like just another pipeline stage.
const RAW_STYLES = {
  active: { color: '#0284C7', badge: 'bg-sky-50 text-sky-700 border border-sky-200' },
  duplicate: { color: '#D97706', badge: 'bg-amber-50 text-amber-700 border border-amber-200' },
  invalid: { color: '#DC2626', badge: 'bg-red-50 text-red-700 border border-red-200' }
};
const STATUS_STYLES = { ...PIPELINE_STYLES, ...RAW_STYLES };

function triggerDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// Every candidate ever entered into the Hiring workspace — active pipeline, closed/terminal,
// and raw duplicate/invalid — with a unified status, searchable/filterable, plus xlsx export.
// The Hiring equivalent of GET /api/leads/master + the Leads workspace's Data Vault export
// (backend/src/index.js), combined into one view since Hiring's /upload-batches endpoint
// already existed with no frontend consumer.
export default function RepositoryPage({ token, showToast }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recruiters, setRecruiters] = useState([]);
  const [batches, setBatches] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '', recruiterId: '' });
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    hiringApi.listRecruiters(token).then(setRecruiters).catch(() => {});
    hiringApi.listUploadBatches(token).then(setBatches).catch(() => {});
  }, [token]);

  const requestId = useRef(0);
  const fetchCandidates = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const data = await hiringApi.getMasterCandidates(token, {
        status: filters.status || undefined,
        recruiterId: filters.recruiterId || undefined,
        search: filters.search || undefined
      });
      if (id !== requestId.current) return;
      setCandidates(data);
    } catch (err) {
      if (id !== requestId.current) return;
      showToast(err.message, 'error');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [token, filters, showToast]);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  const stats = candidates.reduce((acc, c) => {
    acc.total += 1;
    if (c.final_status) acc.closed += 1;
    else if (c.pipeline_status) acc.active += 1;
    else acc.raw += 1;
    return acc;
  }, { total: 0, active: 0, closed: 0, raw: 0 });

  const handleExportAll = async () => {
    setExporting(true);
    try {
      const blob = await hiringApi.exportCandidates(token, {
        status: filters.status || undefined,
        recruiterId: filters.recruiterId || undefined,
        search: filters.search || undefined
      });
      triggerDownload(blob, 'hiring-master-repository.xlsx');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleExportBatch = async (batch) => {
    try {
      const blob = await hiringApi.exportBatch(token, batch.id);
      triggerDownload(blob, `${batch.file_name.replace(/\.[^.]+$/, '')}-export.xlsx`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const [activityCandidate, setActivityCandidate] = useState(null);

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
    { key: 'overall_status', label: 'Status', render: (r) => (
      <StatusBadge status={r.overall_status} styleMap={STATUS_STYLES} />
    ) },
    { key: 'created_at', label: 'Added', render: (r) => r.created_at ? new Date(r.created_at).toLocaleDateString() : '—' }
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon="database" label="Total Candidates" value={stats.total} accent="#7C3AED" />
        <StatCard icon="trending_up" label="Active Pipeline" value={stats.active} accent="#0284C7" />
        <StatCard icon="task_alt" label="Closed" value={stats.closed} accent="#047857" />
        <StatCard icon="inventory_2" label="Raw / Unassigned" value={stats.raw} accent="#D97706" />
      </div>

      {batches.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-xl shadow-sm p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#70787C] dark:text-slate-400 mb-2 font-label-caps">Upload Batches</h3>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {batches.map(b => (
              <div key={b.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-slate-50 dark:hover:bg-slate-900">
                <div className="min-w-0">
                  <span className="font-semibold truncate">{b.file_name}</span>
                  <span className="text-[10px] text-slate-400 ml-2">{new Date(b.upload_date).toLocaleDateString()} · {b.clean_rows} clean, {b.duplicate_rows} dup, {b.invalid_rows} invalid</span>
                </div>
                <button onClick={() => handleExportBatch(b)} className="shrink-0 p-1 border border-[#CBD5E1] dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 rounded" title="Export this batch">
                  <span className="material-symbols-outlined text-sm">download</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-xl shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <input
            placeholder="Search name, phone, email, company..."
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
            className="text-xs p-1.5 bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded col-span-2"
          />
          <select value={filters.recruiterId} onChange={(e) => setFilters(f => ({ ...f, recruiterId: e.target.value }))} className="text-xs p-1.5 bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded">
            <option value="">All Recruiters</option>
            {recruiters.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select value={filters.status} onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))} className="text-xs p-1.5 bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded">
            <option value="">All Statuses</option>
            {HIRING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            <option value="duplicate">Duplicate (raw)</option>
            <option value="invalid">Invalid (raw)</option>
          </select>
        </div>
        <div className="flex justify-end">
          <button onClick={handleExportAll} disabled={exporting} className="text-[10px] font-bold py-1.5 px-3 rounded bg-[#7C3AED] hover:bg-[#6D28D9] text-white flex items-center gap-1 disabled:opacity-50">
            <span className="material-symbols-outlined text-sm">download</span> {exporting ? 'Exporting...' : 'Export All (filtered)'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          rows={candidates}
          loading={loading}
          emptyMessage="No candidates match the current filters."
          onRowClick={(r) => setActivityCandidate(r)}
        />
      </div>

      {activityCandidate && (
        <CandidateActivityModal token={token} candidate={activityCandidate} onClose={() => setActivityCandidate(null)} />
      )}
    </div>
  );
}
