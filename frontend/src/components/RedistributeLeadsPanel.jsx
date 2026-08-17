/**
 * ============================================================================
 * Skill Labs Data Manager - Core Application Service
 *
 * Designed and Developed by:
 *   DIVYANSH KUMAR SHARMA
 *   Associate Product Manager - AI Product and Platforms
 *   Skill Labs Resource Service Private Limited
 *   Phone: +91 6006291486
 *   Email: divyansh6005@gmail.com
 *
 * Description:
 *   Redistribute Worked Leads panel — bulk-reassigns an already-worked
 *   counselor's leads onto one or more other counselors (distinct from
 *   Data Distribution, which only pulls from the raw unassigned pool),
 *   plus a Reassignment History sub-view showing each redistributed
 *   lead's full ownership pathway (old owner/status -> new owner). Shared
 *   between the Manager and Super Admin portals since /api/leads/redistribute
 *   and /api/leads/redistribution-history already authorize both roles
 *   (plus team_leader) on the backend.
 *
 * Copyright (c) 2026. All rights reserved.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { COUNSELING_STATUSES, getStatusStyle } from '../utils/statusStyles';

export default function RedistributeLeadsPanel({ token, counselors, triggerCelebration, onChanged }) {
  const [subView, setSubView] = useState('allocate'); // 'allocate' | 'history'
  const [sourceCounselorId, setSourceCounselorId] = useState('');
  const [statusFilters, setStatusFilters] = useState([]); // [] = all statuses
  const [pool, setPool] = useState([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [allocations, setAllocations] = useState({}); // counselorId -> count
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [expandedPathLeadId, setExpandedPathLeadId] = useState(null);

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch the source counselor's active leads whenever the chosen counselor changes, so
  // "matched pool" always reflects what's actually about to be moved.
  useEffect(() => {
    if (sourceCounselorId) {
      fetchPool(sourceCounselorId);
    } else {
      setPool([]);
    }
    setAllocations({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceCounselorId]);

  const fetchPool = async (counselorId) => {
    setPoolLoading(true);
    try {
      const response = await fetch(`/api/leads/master?counselor_id=${counselorId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        // counselor_id also matches leads this counselor CLOSED (via closures), which have
        // no counseling_status left to move — only currently-active assignments are
        // redistributable.
        setPool(data.filter(l => l.counseling_status != null));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPoolLoading(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      if (historySearch) params.append('search', historySearch);
      const response = await fetch(`/api/leads/redistribution-history?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setHistory(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleStatusFilter = (status) => {
    setStatusFilters(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const handleAllocChange = (counselorId, val) => {
    const intVal = Math.max(0, parseInt(val, 10) || 0);
    setAllocations(prev => ({ ...prev, [counselorId]: intVal }));
  };

  const matched = pool.filter(l =>
    statusFilters.length === 0 || statusFilters.includes(l.counseling_status)
  );
  const targetCounselors = counselors.filter(c => c.id !== sourceCounselorId);
  const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + val, 0);
  const matchedCount = matched.length;
  const remaining = matchedCount - totalAllocated;

  const handleRedistribute = async () => {
    const finalAllocations = Object.keys(allocations)
      .map(cid => ({ counselorId: cid, count: allocations[cid] }))
      .filter(a => a.count > 0);

    if (finalAllocations.length === 0) return;

    try {
      const response = await fetch('/api/leads/redistribute', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sourceCounselorId,
          counselingStatuses: statusFilters,
          allocations: finalAllocations
        })
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Redistribution failed');
      } else {
        if (triggerCelebration) triggerCelebration('Leads Redistributed! 🔄');
        alert(data.message);
        if (onChanged) onChanged();
        fetchPool(sourceCounselorId);
        fetchHistory();
        setAllocations({});
      }
    } catch (err) {
      console.error(err);
      alert('Error during lead redistribution');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E2E8F0] p-6 rounded w-full">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3 mb-6">
          <h2 className="text-sm font-bold text-[#111C2D] uppercase tracking-wide font-label-caps">
            Redistribute Worked Leads
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setSubView('allocate')}
              className={`py-1.5 px-3 text-xs font-semibold rounded transition ${subView === 'allocate' ? 'bg-[#8B5CF6] text-white' : 'bg-[#F8FAFC] border border-[#E2E8F0] text-[#40484B] hover:bg-slate-100'}`}
            >
              Reassign Leads
            </button>
            <button
              onClick={() => setSubView('history')}
              className={`py-1.5 px-3 text-xs font-semibold rounded transition ${subView === 'history' ? 'bg-[#8B5CF6] text-white' : 'bg-[#F8FAFC] border border-[#E2E8F0] text-[#40484B] hover:bg-slate-100'}`}
            >
              Reassignment History
              {history.length > 0 && (
                <span className="ml-1.5 bg-black/10 px-1.5 py-0.5 rounded-full text-[10px]">{history.length}</span>
              )}
            </button>
          </div>
        </div>

        {subView === 'allocate' ? (
          <div className="space-y-6">
            <div className="max-w-md">
              <label className="block text-[11px] text-[#70787C] mb-1 font-body-sm">Source Counselor (whose leads to redistribute)</label>
              <select
                value={sourceCounselorId}
                onChange={(e) => setSourceCounselorId(e.target.value)}
                className="w-full text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded focus:outline-none focus:border-[#0F4C5C]"
              >
                <option value="">-- Select Counselor --</option>
                {counselors.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.load} leads)</option>
                ))}
              </select>
            </div>

            {sourceCounselorId && (
              <>
                <div>
                  <label className="block text-[11px] text-[#70787C] mb-2 font-body-sm">
                    Filter by Counseling Status (optional — leave empty to include all)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {COUNSELING_STATUSES.map(s => (
                      <button
                        key={s}
                        onClick={() => toggleStatusFilter(s)}
                        className={`px-2 py-1 rounded text-[10px] font-semibold border transition ${
                          statusFilters.includes(s)
                            ? 'bg-[#0F4C5C] text-white border-[#0F4C5C]'
                            : 'bg-white text-[#40484B] border-[#E2E8F0] hover:bg-slate-50'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {poolLoading ? (
                  <div className="p-6 text-center text-xs text-[#70787C] italic">Loading counselor's leads...</div>
                ) : matchedCount === 0 ? (
                  <div className="p-6 text-center border border-[#E2E8F0] rounded bg-[#F8FAFC]">
                    <span className="material-symbols-outlined text-4xl text-[#70787C] mb-2">filter_none</span>
                    <p className="text-xs font-semibold text-[#111C2D]">No active leads match this counselor/filter.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3 space-y-6">
                      <div className="border border-[#E2E8F0] rounded overflow-hidden">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#70787C] uppercase tracking-wider font-label-caps">
                              <th className="p-3">Target Counselor</th>
                              <th className="p-3 text-center">Current Active Load</th>
                              <th className="p-3 text-right">Assign Lead Count</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E2E8F0] text-xs font-body-sm text-[#111C2D]">
                            {targetCounselors.map(c => (
                              <tr key={c.id} className="hover:bg-[#F8FAFC]">
                                <td className="p-3 font-semibold">{c.name}</td>
                                <td className="p-3 text-center font-data-mono">{c.load} leads</td>
                                <td className="p-3 text-right">
                                  <input
                                    type="number"
                                    min="0"
                                    max={remaining + (allocations[c.id] || 0)}
                                    value={allocations[c.id] || 0}
                                    onChange={(e) => handleAllocChange(c.id, e.target.value)}
                                    className="w-24 text-right text-xs p-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded font-data-mono focus:ring-1 focus:ring-[#0F4C5C]"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="grid grid-cols-3 gap-4 bg-[#F8FAFC] border border-[#E2E8F0] p-4 rounded">
                        <div className="text-center">
                          <div className="text-xs text-[#70787C] uppercase font-label-caps">Matched Pool</div>
                          <div className="text-xl font-bold mt-1 font-data-mono text-[#111C2D]">{matchedCount}</div>
                        </div>
                        <div className="text-center border-x border-[#E2E8F0]">
                          <div className="text-xs text-[#70787C] uppercase font-label-caps">Allocated</div>
                          <div className="text-xl font-bold mt-1 font-data-mono text-[#8B5CF6]">{totalAllocated}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-[#70787C] uppercase font-label-caps">Remaining</div>
                          <div className={`text-xl font-bold mt-1 font-data-mono ${remaining < 0 ? 'text-[#BA1A1A]' : 'text-[#70787C]'}`}>
                            {remaining}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 border-t border-[#E2E8F0] pt-4">
                        <button
                          onClick={() => setAllocations({})}
                          className="py-1.5 px-3 border border-[#E2E8F0] text-xs font-semibold rounded hover:bg-[#F8FAFC]"
                        >
                          Reset Counts
                        </button>
                        <button
                          onClick={handleRedistribute}
                          disabled={totalAllocated <= 0 || remaining < 0}
                          className="py-1.5 px-4 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-semibold rounded disabled:opacity-50 transition"
                        >
                          Redistribute Leads
                        </button>
                      </div>
                    </div>

                    <div className="lg:col-span-2 space-y-4">
                      <div className="bg-[#F5F3FF] border border-[#DDD6FE] p-4 rounded-xl shadow-sm text-xs space-y-2">
                        <h4 className="text-xs font-bold text-[#5B21B6] uppercase tracking-wider font-label-caps flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm text-[#7C3AED]">info</span>
                          How Redistribution Works
                        </h4>
                        <ul className="list-disc pl-4 space-y-1 text-[#5B21B6] text-[11px] leading-snug">
                          <li>Only leads currently owned by the source counselor and not yet closed are eligible.</li>
                          <li>Counseling status, remarks, registration and fee progress carry over unchanged — only the owner changes.</li>
                          <li>Applies immediately — no Team Leader approval needed, same as manual distribution.</li>
                          <li>Every move is logged and visible in Reassignment History.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-1.5 bg-white border border-[#CBD5E1] px-2.5 py-1.5 rounded-lg w-fit">
              <span className="material-symbols-outlined text-[#70787C] text-sm">search</span>
              <input
                type="text"
                placeholder="Search name, phone, email..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchHistory()}
                className="text-xs focus:outline-none w-56 font-body-sm bg-white"
              />
              <button
                onClick={fetchHistory}
                className="text-[10px] font-bold text-[#8B5CF6] uppercase"
              >
                Search
              </button>
            </div>

            <div className="border border-[#E2E8F0] rounded overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#70787C] uppercase tracking-wider font-label-caps">
                    <th className="p-3">Candidate</th>
                    <th className="p-3">Current Owner</th>
                    <th className="p-3">Current Status</th>
                    <th className="p-3 text-center">Hops</th>
                    <th className="p-3">Last Moved</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-xs font-body-sm text-[#111C2D]">
                  {historyLoading ? (
                    <tr><td colSpan="6" className="p-8 text-center text-[#70787C] italic">Loading reassignment history...</td></tr>
                  ) : history.length === 0 ? (
                    <tr><td colSpan="6" className="p-8 text-center text-[#70787C] italic">No leads have been redistributed yet.</td></tr>
                  ) : (
                    history.map(lead => (
                      <React.Fragment key={lead.id}>
                        <tr
                          onClick={() => setExpandedPathLeadId(expandedPathLeadId === lead.id ? null : lead.id)}
                          className="hover:bg-[#F1F5F9] cursor-pointer transition"
                        >
                          <td className="p-3 font-semibold text-[#0F4C5C]">{lead.name}</td>
                          <td className="p-3">{lead.current_counselor_name || <span className="text-slate-400 italic">Unassigned</span>}</td>
                          <td className="p-3">
                            {lead.final_status ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium uppercase bg-slate-100 text-slate-700 border border-slate-200">
                                {lead.final_status}
                              </span>
                            ) : lead.counseling_status ? (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusStyle(lead.counseling_status).badge}`}>
                                {lead.counseling_status}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">—</span>
                            )}
                          </td>
                          <td className="p-3 text-center font-data-mono">{lead.hopCount}</td>
                          <td className="p-3 text-[#70787C]">{lead.lastMovedAt ? new Date(lead.lastMovedAt).toLocaleString() : '—'}</td>
                          <td className="p-3 text-right text-[#8B5CF6]">
                            <span className="material-symbols-outlined text-sm">
                              {expandedPathLeadId === lead.id ? 'expand_less' : 'expand_more'}
                            </span>
                          </td>
                        </tr>
                        {expandedPathLeadId === lead.id && (
                          <tr>
                            <td colSpan="6" className="p-4 bg-[#F8FAFC]">
                              <div className="text-[10px] font-bold text-[#70787C] uppercase tracking-wider font-label-caps mb-2">Ownership Pathway</div>
                              <div className="flex flex-wrap items-center gap-2">
                                {lead.path.map((hop, idx) => (
                                  <React.Fragment key={idx}>
                                    <div className="bg-white border border-[#E2E8F0] rounded px-2.5 py-1.5 text-[11px]">
                                      <div className="font-semibold text-[#111C2D]">{hop.counselorName}</div>
                                      <div className="text-[#70787C] font-data-mono text-[10px]">{new Date(hop.timestamp).toLocaleString()}</div>
                                    </div>
                                    {idx < lead.path.length - 1 && (
                                      <span className="material-symbols-outlined text-sm text-[#8B5CF6]">arrow_forward</span>
                                    )}
                                  </React.Fragment>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
