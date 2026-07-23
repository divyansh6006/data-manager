import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { hiringApi } from '../services/hiringApi';

// Mirrors Admissions' "Manual Count Allocation Distribution Dashboard" (ManagerDashboard.jsx)
// exactly: filter the unassigned pool, type a candidate COUNT per recruiter (not individual
// selection), see live Available/Allocated/Remaining totals + a proposed-load bar chart, then
// one button atomically hands out that many oldest-first candidates per recruiter.
export default function DistributePage({ token, showToast }) {
  const [pool, setPool] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recruiters, setRecruiters] = useState([]);
  const [filters, setFilters] = useState({ search: '', location: '', experienceMin: '', experienceMax: '', currentCompany: '', createdFrom: '', createdTo: '' });
  const [allocations, setAllocations] = useState({});
  const [distributing, setDistributing] = useState(false);

  const fetchPool = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hiringApi.listCandidates(token, { ...filters, unassigned: 'true' });
      setPool(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [token, filters]);

  useEffect(() => { fetchPool(); }, [fetchPool]);
  useEffect(() => { hiringApi.listRecruiters(token).then(setRecruiters).catch(() => {}); }, [token]);

  const handleAllocChange = (recruiterId, val) => {
    const intVal = Math.max(0, parseInt(val, 10) || 0);
    setAllocations(prev => ({ ...prev, [recruiterId]: intVal }));
  };

  const totalPoolAvailable = pool.length;
  const totalAllocated = Object.values(allocations).reduce((sum, v) => sum + v, 0);
  const remainingInPool = totalPoolAvailable - totalAllocated;

  const handleDistribute = async () => {
    const finalAllocations = Object.keys(allocations)
      .map(recruiterId => ({ recruiterId, count: allocations[recruiterId] }))
      .filter(a => a.count > 0);
    if (finalAllocations.length === 0) return;

    setDistributing(true);
    try {
      const data = await hiringApi.distributeCandidates(token, { allocations: finalAllocations, filterCriteria: filters });
      showToast(data.message || 'Candidates distributed.', 'success');
      setAllocations({});
      fetchPool();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDistributing(false);
    }
  };

  const chartData = useMemo(() => recruiters.map(r => ({
    name: r.name.split(' ')[0],
    'Current Active Load': r.load,
    'Proposed New': allocations[r.id] || 0
  })), [recruiters, allocations]);

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-xl shadow-sm p-4 space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-[#111C2D] dark:text-white font-label-caps">Filter the Distribution Pool</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <input placeholder="Search" value={filters.search} onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))} className="text-xs p-1.5 bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded" />
          <input placeholder="Location" value={filters.location} onChange={(e) => setFilters(f => ({ ...f, location: e.target.value }))} className="text-xs p-1.5 bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded" />
          <input type="number" step="0.5" placeholder="Exp. Min" value={filters.experienceMin} onChange={(e) => setFilters(f => ({ ...f, experienceMin: e.target.value }))} className="text-xs p-1.5 bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded" />
          <input type="number" step="0.5" placeholder="Exp. Max" value={filters.experienceMax} onChange={(e) => setFilters(f => ({ ...f, experienceMax: e.target.value }))} className="text-xs p-1.5 bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded" />
          <input placeholder="Current Company" value={filters.currentCompany} onChange={(e) => setFilters(f => ({ ...f, currentCompany: e.target.value }))} className="text-xs p-1.5 bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded" />
          <input type="date" value={filters.createdFrom} onChange={(e) => setFilters(f => ({ ...f, createdFrom: e.target.value }))} className="text-xs p-1.5 bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded" title="Added from" />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 p-6 rounded-xl">
        <h2 className="text-sm font-bold text-[#111C2D] dark:text-white uppercase tracking-wide font-label-caps border-b border-[#E2E8F0] dark:border-slate-700 pb-3 mb-6 flex justify-between">
          <span>Manual Count Allocation Distribution Dashboard</span>
          <span className="text-[#7C3AED] font-semibold text-xs font-data-mono">Pool Available: {loading ? '...' : totalPoolAvailable} Candidates</span>
        </h2>

        {!loading && totalPoolAvailable === 0 ? (
          <div className="p-6 text-center border border-[#E2E8F0] dark:border-slate-700 rounded bg-[#F8FAFC] dark:bg-slate-900">
            <span className="material-symbols-outlined text-4xl text-[#70787C] dark:text-slate-500 mb-2">filter_none</span>
            <p className="text-xs font-semibold text-[#111C2D] dark:text-white">No candidates in the distribution pool.</p>
            <p className="text-[11px] text-[#70787C] dark:text-slate-400 mt-1">Upload candidates first, or adjust the filters above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-6">
              <div className="border border-[#E2E8F0] dark:border-slate-700 rounded overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F8FAFC] dark:bg-slate-900 border-b border-[#E2E8F0] dark:border-slate-700 text-[10px] font-bold text-[#70787C] dark:text-slate-400 uppercase tracking-wider font-label-caps">
                      <th className="p-3">Recruiter</th>
                      <th className="p-3 text-center">Current Active Load</th>
                      <th className="p-3 text-right">Assign Candidate Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-slate-700 text-xs text-[#111C2D] dark:text-slate-200">
                    {recruiters.map(r => (
                      <tr key={r.id} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-900">
                        <td className="p-3 font-semibold">{r.name}</td>
                        <td className="p-3 text-center font-data-mono">{r.load} candidates</td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            min="0"
                            max={remainingInPool + (allocations[r.id] || 0)}
                            value={allocations[r.id] || 0}
                            onChange={(e) => handleAllocChange(r.id, e.target.value)}
                            className="w-24 text-right text-xs p-1 bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-700 rounded font-data-mono focus:ring-1 focus:ring-[#7C3AED]"
                          />
                        </td>
                      </tr>
                    ))}
                    {recruiters.length === 0 && (
                      <tr><td colSpan={3} className="p-4 text-center text-slate-400 italic">No active recruiters yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-3 gap-4 bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-700 p-4 rounded">
                <div className="text-center">
                  <div className="text-xs text-[#70787C] dark:text-slate-400 uppercase font-label-caps">Available Pool</div>
                  <div className="text-xl font-bold mt-1 font-data-mono text-[#111C2D] dark:text-white">{totalPoolAvailable}</div>
                </div>
                <div className="text-center border-x border-[#E2E8F0] dark:border-slate-700">
                  <div className="text-xs text-[#70787C] dark:text-slate-400 uppercase font-label-caps">Allocated</div>
                  <div className="text-xl font-bold mt-1 font-data-mono text-[#7C3AED]">{totalAllocated}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-[#70787C] dark:text-slate-400 uppercase font-label-caps">Remaining</div>
                  <div className={`text-xl font-bold mt-1 font-data-mono ${remainingInPool < 0 ? 'text-[#BA1A1A]' : 'text-[#70787C] dark:text-slate-400'}`}>{remainingInPool}</div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-[#E2E8F0] dark:border-slate-700 pt-4">
                <button
                  onClick={() => {
                    const reset = {};
                    recruiters.forEach(r => { reset[r.id] = 0; });
                    setAllocations(reset);
                  }}
                  className="py-1.5 px-3 border border-[#E2E8F0] dark:border-slate-700 dark:text-slate-300 text-xs font-semibold rounded hover:bg-[#F8FAFC] dark:hover:bg-slate-900"
                >
                  Reset Counts
                </button>
                <button
                  onClick={handleDistribute}
                  disabled={totalAllocated <= 0 || remainingInPool < 0 || distributing}
                  className="py-1.5 px-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold rounded disabled:opacity-50 transition"
                >
                  {distributing ? 'Distributing...' : 'Atomic Reconcile & Assign'}
                </button>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-700 p-4 rounded-xl shadow-sm h-[320px] flex flex-col justify-between">
                <h4 className="text-xs font-bold text-[#40484B] dark:text-slate-300 uppercase tracking-wider font-label-caps flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-[#7C3AED]">bar_chart</span>
                  Proposed Recruiter Load Share
                </h4>
                <div className="flex-1 w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={true} vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#70787C' }} />
                      <YAxis tick={{ fontSize: 9, fill: '#70787C' }} />
                      <Tooltip contentStyle={{ fontSize: 10 }} />
                      <Legend wrapperStyle={{ fontSize: 9 }} />
                      <Bar dataKey="Current Active Load" stackId="a" fill="#7C3AED" />
                      <Bar dataKey="Proposed New" stackId="a" fill="#F59E0B" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-[#F0FDF4] dark:bg-green-950/20 border border-[#DCFCE7] dark:border-green-900 p-4 rounded-xl shadow-sm text-xs space-y-2">
                <h4 className="text-xs font-bold text-green-800 dark:text-green-400 uppercase tracking-wider font-label-caps flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-green-700 dark:text-green-400">info</span>
                  Distribution Rules Enforced
                </h4>
                <ul className="list-disc pl-4 space-y-1 text-green-700 dark:text-green-400 text-[11px] leading-snug">
                  <li><strong>Zero double allocation:</strong> No single candidate can be assigned to two recruiters.</li>
                  <li><strong>Atomic assignments:</strong> Allocating the candidates is all-or-nothing.</li>
                  <li><strong>Fair mix:</strong> Fresher/experienced candidates are split proportionally across recruiters.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
