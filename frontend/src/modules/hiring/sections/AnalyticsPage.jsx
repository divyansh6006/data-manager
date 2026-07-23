import React, { useState, useEffect, useCallback, useRef } from 'react';
import { hiringApi } from '../services/hiringApi';
import StatusDistributionChart from '../components/StatusDistributionChart';
import PipelineFunnelChart from '../components/PipelineFunnelChart';
import RecruiterPerformanceChart from '../components/RecruiterPerformanceChart';
import WeeklyTrendChart from '../components/WeeklyTrendChart';
import { SkeletonCard } from '../../../shared/components/SkeletonLoader';

export default function AnalyticsPage({ token, scope, showToast }) {
  const [pipeline, setPipeline] = useState(null);
  const [recruiterPerf, setRecruiterPerf] = useState([]);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);

  // Same stale-response guard as CandidatesPage.jsx/DashboardHome.jsx.
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    console.debug(`[AnalyticsPage] load#${id} start`, { recruiterId: scope.recruiterId });
    try {
      const [pipelineData, perfData, trendData] = await Promise.all([
        hiringApi.getPipelineReport(token, scope.recruiterId),
        hiringApi.getRecruiterPerformanceReport(token),
        hiringApi.getDashboardTrend(token, 30)
      ]);
      if (id !== requestId.current) {
        console.debug(`[AnalyticsPage] load#${id} discarded (stale — #${requestId.current} is latest)`);
        return;
      }
      console.debug(`[AnalyticsPage] load#${id} applied`);
      setPipeline(pipelineData);
      setRecruiterPerf(perfData);
      setTrend(trendData);
    } catch (err) {
      if (id !== requestId.current) return;
      showToast(err.message, 'error');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [token, scope]);

  useEffect(() => { load(); }, [load]);

  if (loading || !pipeline) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#40484B] dark:text-slate-300 font-label-caps mb-4">30-Day Candidate Trend</h3>
        <WeeklyTrendChart data={trend} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#40484B] dark:text-slate-300 font-label-caps mb-4">Status Distribution (Active Pipeline)</h3>
          <StatusDistributionChart data={pipeline.active} />
        </div>
        <div className="bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#40484B] dark:text-slate-300 font-label-caps mb-4">Closed Outcomes Distribution</h3>
          <StatusDistributionChart data={pipeline.closed} />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#40484B] dark:text-slate-300 font-label-caps mb-4">Recruiter Performance Graph</h3>
        <RecruiterPerformanceChart data={recruiterPerf} />
      </div>
    </div>
  );
}
