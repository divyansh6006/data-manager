import React, { useState, useEffect, useCallback, useRef } from 'react';
import Modal from '../../../shared/components/Modal';
import DataTable from '../../../shared/components/DataTable';
import StatusBadge from '../../../shared/components/StatusBadge';
import { MaskedPhone, MaskedEmail } from '../../../shared/components/MaskedContact';
import { hiringApi } from '../services/hiringApi';
import { getPipelineStyle, HIRING_STATUSES, TERMINAL_HIRING_STATUSES } from '../constants/pipeline';
import CandidateActivityModal from '../components/CandidateActivityModal';
import CandidateFormModal from '../components/CandidateFormModal';
import AssignTransferModal from '../components/AssignTransferModal';
import StatusUpdateModal from '../components/StatusUpdateModal';

const ADVANCED_FILTER_DEFAULTS = {
  experienceMin: '', experienceMax: '', currentCompany: '', registrationStatus: '', interviewStatus: '', createdFrom: '', createdTo: ''
};

// Terminal statuses (Selected/Rejected/Joined/Closed) move to hiring_closures and drop out
// of the active candidate list entirely, so they're not meaningful categories to filter by
// here — the pill grid only covers the statuses a candidate can actually sit at while assigned.
const ACTIVE_PIPELINE_STATUSES = HIRING_STATUSES.filter(s => !TERMINAL_HIRING_STATUSES.includes(s));

export default function CandidatesPage({ token, role, scope, showToast, searchOverride, statusFilterOverride }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recruiters, setRecruiters] = useState([]);
  // Defaults to the 'New' pool, not everyone — that's the actual work queue; once a
  // candidate is moved to Interested/Call Back/etc. they naturally leave this default view
  // and only show up again under their own category pill or the explicit "All" pill.
  const [filters, setFilters] = useState({ search: '', status: 'New', location: '', ...ADVANCED_FILTER_DEFAULTS });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [viewMode, setViewMode] = useState('assigned'); // 'assigned' | 'unassigned'
  const [activityCandidate, setActivityCandidate] = useState(null);
  const [modal, setModal] = useState(null); // { type, candidate }
  const [statusCounts, setStatusCounts] = useState({});
  const searchInputRef = useRef(null);

  const canManage = role === 'super_admin' || role === 'hiring_team_leader';
  // Pipeline status is the recruiter's own working action, not a team leader supervision
  // power — team leaders get team overview, reporting, and transfer approvals instead
  // (mirrors the backend's requireRole(['super_admin', 'recruiter']) on PUT .../status).
  const canChangeStatus = role === 'super_admin' || role === 'recruiter';

  // "/" focuses the search box, unless the user is already typing somewhere — a bare
  // useKeyboardShortcut would preventDefault() unconditionally and swallow every literal
  // "/" keystroke typed into other fields (e.g. a notes textarea), so this checks
  // document.activeElement itself before deciding to intercept the key at all.
  useEffect(() => {
    const listener = (e) => {
      if (e.key !== '/') return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  // Deep-link support: the Command Palette (Ctrl+K) can jump straight here with a candidate
  // pre-filtered into view — { search, ts } shape (not a bare string) so re-selecting the
  // same candidate twice in a row still re-applies the filter even though search didn't change.
  // Also clears the status filter — the default view is scoped to 'New', so searching for a
  // specific candidate who's already moved past that stage would otherwise turn up nothing.
  useEffect(() => {
    if (searchOverride?.search) {
      setViewMode('assigned');
      setFilters(f => ({ ...f, search: searchOverride.search, status: '' }));
    }
  }, [searchOverride]);

  // Lets the Dashboard's stat cards jump straight here pre-filtered (e.g. clicking
  // "Interview Scheduled" shows exactly that status) — { status, ts } shape so re-clicking
  // the same card twice in a row still re-applies the filter even though status didn't change.
  useEffect(() => {
    if (statusFilterOverride?.status) {
      setViewMode('assigned');
      setFilters(f => ({ ...f, status: statusFilterOverride.status }));
    }
  }, [statusFilterOverride]);

  // Both the candidate list and the pill counts below are fetched async and can resolve
  // out of order (e.g. clicking two different status pills in quick succession fires two
  // overlapping requests — nothing guarantees the second one finishes first). Each fetcher
  // tags its own request with an incrementing id and only applies the response if it's
  // still the most recent one in flight; anything older is logged and discarded instead of
  // silently overwriting newer, correct state with stale data.
  const candidatesRequestId = useRef(0);
  const countsRequestId = useRef(0);

  const fetchCandidates = useCallback(async () => {
    const requestId = ++candidatesRequestId.current;
    setLoading(true);
    console.debug(`[CandidatesPage] fetchCandidates#${requestId} start`, { filters, viewMode, recruiterId: filters.recruiterId });
    try {
      const data = await hiringApi.listCandidates(token, { ...scope, ...filters, unassigned: viewMode === 'unassigned' ? 'true' : undefined });
      if (requestId !== candidatesRequestId.current) {
        console.debug(`[CandidatesPage] fetchCandidates#${requestId} discarded (stale — #${candidatesRequestId.current} is latest)`);
        return;
      }
      console.debug(`[CandidatesPage] fetchCandidates#${requestId} applied`, { rows: data.length });
      setCandidates(data);
    } catch (err) {
      if (requestId !== candidatesRequestId.current) return;
      showToast(err.message, 'error');
    } finally {
      if (requestId === candidatesRequestId.current) setLoading(false);
    }
  }, [token, scope, filters, viewMode]);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  // Pill counts for the category grid. These represent the full status distribution for the
  // current scope (team/recruiter), independent of the candidate table's own status/search/
  // advanced filters — so this deliberately does NOT depend on `candidates` (which changes on
  // every keystroke in the search box) or on `filters.status` (clicking a pill doesn't change
  // what the pill grid itself is counting). It refetches only when the actual scope changes
  // (recruiter filter, view mode) or when `countsRefreshToken` is bumped after a mutation
  // that can change the distribution (status update, assignment, transfer, new candidate).
  const [countsRefreshToken, setCountsRefreshToken] = useState(0);
  const refreshCounts = useCallback(() => setCountsRefreshToken(t => t + 1), []);

  useEffect(() => {
    if (viewMode !== 'assigned') return;
    const requestId = ++countsRequestId.current;
    // Previously this always passed scope.recruiterId, which is a permanently-empty {} on
    // every Hiring dashboard shell — the "All Recruiters" dropdown (filters.recruiterId) was
    // never actually wired in, so the pill totals never matched a recruiter-filtered table.
    console.debug(`[CandidatesPage] fetchCounts#${requestId} start`, { recruiterId: filters.recruiterId });
    hiringApi.getDashboardSummary(token, filters.recruiterId).then(s => {
      if (requestId !== countsRequestId.current) {
        console.debug(`[CandidatesPage] fetchCounts#${requestId} discarded (stale — #${countsRequestId.current} is latest)`);
        return;
      }
      console.debug(`[CandidatesPage] fetchCounts#${requestId} applied`, s.statusBreakdown);
      setStatusCounts(s.statusBreakdown || {});
    }).catch((err) => {
      if (requestId !== countsRequestId.current) return;
      console.debug(`[CandidatesPage] fetchCounts#${requestId} failed`, err.message);
    });
  }, [token, viewMode, filters.recruiterId, countsRefreshToken]);

  useEffect(() => {
    if (!canManage) return;
    hiringApi.listRecruiters(token).then(setRecruiters).catch(() => {});
  }, [token, canManage]);

  const closeModal = () => setModal(null);

  const handleAddCandidate = async (body) => {
    await hiringApi.createCandidate(token, body);
    showToast('Candidate added successfully.', 'success');
    closeModal();
    fetchCandidates();
  };

  const handleAssign = async (body) => {
    await hiringApi.assignCandidate(token, modal.candidate.id, body);
    showToast('Candidate assigned.', 'success');
    closeModal();
    fetchCandidates();
    refreshCounts();
  };

  const handleStatusUpdate = async (body) => {
    await hiringApi.updateStatus(token, modal.candidate.id, body);
    showToast('Status updated.', 'success');
    closeModal();
    fetchCandidates();
    refreshCounts();
  };

  const handleTransfer = async (body) => {
    await hiringApi.requestTransfer(token, modal.candidate.id, body);
    showToast('Transfer request submitted.', 'success');
    closeModal();
  };

  const nameColumn = { key: 'name', label: 'Candidate', render: (r) => (
    <div>
      <div className="font-semibold">{r.name}</div>
      <div className="text-[10px] text-slate-400"><MaskedPhone phone={r.phone} /></div>
      <div className="text-[10px] text-slate-400"><MaskedEmail email={r.email} /></div>
    </div>
  ) };
  const locationColumn = { key: 'current_location', label: 'Location' };
  const experienceColumn = { key: 'experience', label: 'Exp', render: (r) => r.experience != null ? `${r.experience} yrs` : '—' };
  const currentCoColumn = { key: 'current_company', label: 'Current Co.' };

  const assignedColumns = [
    nameColumn, locationColumn, experienceColumn, currentCoColumn,
    { key: 'pipeline_status', label: 'Status', render: (r) => (
      <StatusBadge status={r.pipeline_status} styleMap={{ [r.pipeline_status]: getPipelineStyle(r.pipeline_status) }} />
    ) },
    { key: 'interview', label: 'Interview', render: (r) => {
      if (!r.latest_interview_date) return <span className="text-slate-400">—</span>;
      return (
        <div>
          <div className="font-data-mono text-[11px]">{r.latest_interview_date}{r.latest_interview_time ? ` ${r.latest_interview_time}` : ''}</div>
          <div className="text-[10px] text-slate-400">
            {r.latest_interview_status}{r.latest_interview_result && r.latest_interview_result !== 'Pending' ? ` — ${r.latest_interview_result}` : ''}
          </div>
        </div>
      );
    } },
    { key: 'recruiter_name', label: 'Recruiter', render: (r) => r.recruiter_name || '—' },
    { key: 'actions', label: '', className: 'text-right', render: (r) => (
      <div className="flex items-center justify-end gap-1">
        <button onClick={() => setActivityCandidate(r)} className="p-1 border border-[#CBD5E1] dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 rounded" title="View activity history">
          <span className="material-symbols-outlined text-sm">forum</span>
        </button>
        {role === 'recruiter' ? (
          <button onClick={() => setModal({ type: 'transfer', candidate: r })} className="p-1 border border-[#CBD5E1] dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 rounded" title="Request transfer">
            <span className="material-symbols-outlined text-sm">swap_horiz</span>
          </button>
        ) : (
          <button onClick={() => setModal({ type: 'assign', candidate: r })} className="p-1 border border-[#CBD5E1] dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 rounded" title="Reassign">
            <span className="material-symbols-outlined text-sm">person_add</span>
          </button>
        )}
        {canChangeStatus && (
          <button onClick={() => setModal({ type: 'updateStatus', candidate: r })} className="py-1 px-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded text-[10px] font-bold flex items-center gap-1" title="Update status">
            <span className="material-symbols-outlined text-xs">edit</span> Update
          </button>
        )}
      </div>
    ) }
  ];

  const unassignedColumns = [
    nameColumn, locationColumn, experienceColumn, currentCoColumn,
    { key: 'source', label: 'Source', render: (r) => r.source || '—' },
    { key: 'created_at', label: 'Added', render: (r) => r.created_at ? new Date(r.created_at).toLocaleDateString() : '—' },
    { key: 'actions', label: '', render: (r) => (
      <button onClick={(e) => { e.stopPropagation(); setModal({ type: 'assign', candidate: r }); }} className="text-[10px] font-bold py-1 px-2.5 rounded bg-[#7C3AED] text-white hover:bg-[#6D28D9]">
        Assign
      </button>
    ) }
  ];

  const columns = viewMode === 'unassigned' ? unassignedColumns : assignedColumns;

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-xl shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 rounded-lg p-1">
            <button
              onClick={() => setViewMode('assigned')}
              className={`text-[10px] font-bold uppercase tracking-wider py-1.5 px-3 rounded-md font-label-caps ${viewMode === 'assigned' ? 'bg-white dark:bg-slate-700 text-[#7C3AED] shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
            >
              Assigned
            </button>
            {canManage && (
              <button
                onClick={() => setViewMode('unassigned')}
                className={`text-[10px] font-bold uppercase tracking-wider py-1.5 px-3 rounded-md font-label-caps ${viewMode === 'unassigned' ? 'bg-white dark:bg-slate-700 text-[#7C3AED] shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
              >
                Unassigned{viewMode === 'unassigned' ? ` (${candidates.length})` : ''}
              </button>
            )}
          </div>
          {canManage && (
            <button onClick={() => setModal({ type: 'add' })} className="text-[10px] font-bold py-1.5 px-3 rounded bg-[#7C3AED] hover:bg-[#6D28D9] text-white flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">person_add</span> Add Candidate
            </button>
          )}
        </div>

        {viewMode === 'assigned' && (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {(() => {
              const allPill = { key: '', label: 'All', color: '#7C3AED', count: Object.values(statusCounts).reduce((sum, v) => sum + v, 0) };
              // Non-empty categories lead (most candidates first) so attention naturally goes
              // to what still needs work; a category that's been fully cleared out sinks to
              // the back instead of taking up the same visual weight as an active one.
              const rest = ACTIVE_PIPELINE_STATUSES
                .map(s => ({ key: s, label: s, color: getPipelineStyle(s).color, count: statusCounts[s] || 0 }))
                .sort((a, b) => b.count - a.count);
              return [allPill, ...rest].map(pill => {
                const active = filters.status === pill.key;
                const isEmpty = pill.key !== '' && pill.count === 0;
                return (
                  <button
                    key={pill.label}
                    onClick={() => setFilters(f => ({ ...f, status: pill.key }))}
                    className={`flex flex-col items-center p-2.5 rounded-lg border-2 transition hover:shadow-sm bg-white dark:bg-slate-900 ${isEmpty ? 'opacity-40 hover:opacity-100' : ''}`}
                    style={{ borderColor: active ? pill.color : 'transparent', background: active ? `${pill.color}11` : undefined }}
                  >
                    <span className="text-lg font-black font-data-mono" style={{ color: isEmpty ? undefined : pill.color }}>{pill.count}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5 text-center leading-tight" style={{ color: isEmpty ? undefined : pill.color }}>{pill.label}</span>
                  </button>
                );
              });
            })()}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <input
            ref={searchInputRef}
            placeholder="Search name, phone, email, skills... (Press / to focus)"
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
            className="text-xs p-1.5 bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded col-span-2"
          />
          <input placeholder="Location" value={filters.location} onChange={(e) => setFilters(f => ({ ...f, location: e.target.value }))} className="text-xs p-1.5 bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded" />
          {canManage && viewMode === 'assigned' && (
            <select value={filters.recruiterId || ''} onChange={(e) => setFilters(f => ({ ...f, recruiterId: e.target.value }))} className="text-xs p-1.5 bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded">
              <option value="">All Recruiters</option>
              {recruiters.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
          <button onClick={() => setShowAdvanced(v => !v)} className="text-[10px] font-bold py-1.5 px-3 rounded border border-[#CBD5E1] dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-sm">tune</span> {showAdvanced ? 'Hide' : 'Advanced'}
          </button>
        </div>

        {showAdvanced && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-[#E2E8F0] dark:border-slate-700">
            <input type="number" step="0.5" placeholder="Exp. Min (yrs)" value={filters.experienceMin} onChange={(e) => setFilters(f => ({ ...f, experienceMin: e.target.value }))} className="text-xs p-1.5 bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded" />
            <input type="number" step="0.5" placeholder="Exp. Max (yrs)" value={filters.experienceMax} onChange={(e) => setFilters(f => ({ ...f, experienceMax: e.target.value }))} className="text-xs p-1.5 bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded" />
            <input placeholder="Current Company" value={filters.currentCompany} onChange={(e) => setFilters(f => ({ ...f, currentCompany: e.target.value }))} className="text-xs p-1.5 bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded" />
            {viewMode === 'assigned' && (
              <>
                <select value={filters.registrationStatus} onChange={(e) => setFilters(f => ({ ...f, registrationStatus: e.target.value }))} className="text-xs p-1.5 bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded">
                  <option value="">All Registration</option>
                  <option value="Pending">Pending</option>
                  <option value="Completed">Completed</option>
                </select>
                <select value={filters.interviewStatus} onChange={(e) => setFilters(f => ({ ...f, interviewStatus: e.target.value }))} className="text-xs p-1.5 bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded">
                  <option value="">Interview: Any</option>
                  <option value="true">Scheduled</option>
                  <option value="false">Not Scheduled</option>
                </select>
              </>
            )}
            <input type="date" value={filters.createdFrom} onChange={(e) => setFilters(f => ({ ...f, createdFrom: e.target.value }))} className="text-xs p-1.5 bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded" title="Created from" />
            <input type="date" value={filters.createdTo} onChange={(e) => setFilters(f => ({ ...f, createdTo: e.target.value }))} className="text-xs p-1.5 bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded" title="Created to" />
          </div>
        )}

      </div>

      <div className="bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          rows={candidates}
          loading={loading}
          emptyMessage="No candidates match the current filters."
        />
      </div>

      {activityCandidate && (
        <CandidateActivityModal token={token} candidate={activityCandidate} onClose={() => setActivityCandidate(null)} />
      )}

      {modal?.type === 'add' && <CandidateFormModal onClose={closeModal} onSubmit={handleAddCandidate} />}
      {modal?.type === 'assign' && <AssignTransferModal candidate={modal.candidate} recruiters={recruiters} onClose={closeModal} onSubmit={handleAssign} />}
      {modal?.type === 'updateStatus' && <StatusUpdateModal candidate={modal.candidate} onClose={closeModal} onSubmit={handleStatusUpdate} />}
      {modal?.type === 'transfer' && (
        <FollowUpTransferShim candidate={modal.candidate} onClose={closeModal} onSubmit={handleTransfer} />
      )}
    </div>
  );
}

// Minimal inline transfer-request form (recruiter-only action) — small enough not to
// warrant its own file alongside the other modals.
function FollowUpTransferShim({ candidate, onClose, onSubmit }) {
  const [reason, setReason] = useState('Language barrier');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit({ reason, note });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Request Transfer — ${candidate.name}`} icon="swap_horiz" onClose={onClose} maxWidth="max-w-sm"
      footer={(
        <>
          <button type="button" onClick={onClose} className="py-1.5 px-3 border border-[#CBD5E1] text-xs font-semibold rounded">Cancel</button>
          <button form="transfer-form" type="submit" disabled={saving} className="py-1.5 px-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold rounded disabled:opacity-50">
            {saving ? 'Submitting...' : 'Submit Request'}
          </button>
        </>
      )}
    >
      {error && <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded">{error}</div>}
      <form id="transfer-form" onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-[#40484B] mb-1 uppercase font-label-caps">Reason</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded">
            <option>Language barrier</option>
            <option>Location mismatch</option>
            <option>Not responding</option>
            <option>Other</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-[#40484B] mb-1 uppercase font-label-caps">Note</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded h-16" />
        </div>
      </form>
    </Modal>
  );
}
