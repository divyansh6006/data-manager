import React, { useState, useEffect, useCallback, useRef } from 'react';
import StatCard from '../../../shared/components/StatCard';
import { SkeletonCard } from '../../../shared/components/SkeletonLoader';
import { hiringApi } from '../services/hiringApi';
import WeeklyTrendChart from '../components/WeeklyTrendChart';
import PipelineFunnelChart from '../components/PipelineFunnelChart';
import RecentActivityTimeline from '../components/RecentActivityTimeline';
import TodaysScheduleWidget from '../components/TodaysScheduleWidget';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// Action-first layout: time-sensitive items (follow-ups due, interviews today) lead the
// page since those are what actually need a decision right now, followed by grouped/
// clickable pipeline stats (click a card to jump straight to that filtered candidate list),
// then trend charts and history — in roughly descending order of "what do I do today".
// "Which recruiter is doing what" is only meaningful for a role overseeing a team, not an
// individual recruiter looking at their own single-row breakdown.
const CAN_VIEW_RECRUITER_ACTIVITY = ['super_admin', 'hiring_team_leader'];

export default function DashboardHome({ token, scope, showToast, user, role, onNavigateToCandidates }) {
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [activity, setActivity] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [pendingFollowups, setPendingFollowups] = useState([]);
  const [recruiterActivity, setRecruiterActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const showRecruiterActivity = CAN_VIEW_RECRUITER_ACTIVITY.includes(role);

  // Same stale-response guard as CandidatesPage.jsx: tag each load() call with an id and
  // only commit its results if nothing newer has started since — otherwise an old request
  // that happens to resolve last (e.g. after a rapid section revisit) would silently
  // overwrite fresher state with stale numbers.
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    console.debug(`[DashboardHome] load#${id} start`, { recruiterId: scope.recruiterId, role });
    try {
      const [summaryData, trendData, activityData, upcomingData, followupData, recruiterActivityData] = await Promise.all([
        hiringApi.getDashboardSummary(token, scope.recruiterId),
        hiringApi.getDashboardTrend(token, 7),
        hiringApi.getDashboardActivity(token),
        hiringApi.getUpcomingInterviews(token),
        hiringApi.getPendingFollowups(token),
        showRecruiterActivity ? hiringApi.getRecruiterPerformanceReport(token) : Promise.resolve([])
      ]);
      if (id !== requestId.current) {
        console.debug(`[DashboardHome] load#${id} discarded (stale — #${requestId.current} is latest)`);
        return;
      }
      console.debug(`[DashboardHome] load#${id} applied`);
      setSummary(summaryData);
      setTrend(trendData);
      setActivity(activityData);
      setUpcoming(upcomingData);
      setPendingFollowups(followupData);
      setRecruiterActivity(recruiterActivityData);
    } catch (err) {
      if (id !== requestId.current) return;
      showToast(err.message, 'error');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [token, scope, showRecruiterActivity]);

  useEffect(() => { load(); }, [load]);

  const pipelineData = summary ? Object.entries(summary.statusBreakdown).map(([status, count]) => ({ status, count })) : [];
  const goTo = (status) => onNavigateToCandidates && onNavigateToCandidates(status);

  if (loading && !summary) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  const attentionCount = pendingFollowups.length + upcoming.length;

  return (
    <div className="space-y-6">
      {user && (
        <div>
          <h2 className="text-base font-bold text-[#111C2D] dark:text-white font-headline-md">{greeting()}, {user.name?.split(' ')[0]}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {attentionCount > 0
              ? `You have ${attentionCount} item${attentionCount === 1 ? '' : 's'} that need attention today.`
              : "You're all caught up — nothing urgent needs attention right now."}
          </p>
        </div>
      )}

      {/* Needs Your Attention — time-sensitive items lead the page */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#40484B] dark:text-slate-300 font-label-caps mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500 text-base">schedule</span>
            Pending Follow-ups ({pendingFollowups.length})
          </h3>
          {pendingFollowups.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No pending follow-ups — nothing due.</p>
          ) : (
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {pendingFollowups.map(f => (
                <div key={f.id} className="p-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                  <p className="text-xs font-semibold dark:text-white">{f.candidate_name}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-data-mono">{new Date(f.follow_up_date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  {f.notes && <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">{f.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 border border-violet-200 dark:border-violet-800 rounded-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#40484B] dark:text-slate-300 font-label-caps mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#7C3AED] text-base">event_available</span>
            Today's Schedule / Upcoming Interviews
          </h3>
          <TodaysScheduleWidget interviews={upcoming} />
        </div>
      </div>

      {/* Pipeline progress — click any card to jump to that filtered candidate list */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#40484B] dark:text-slate-400 font-label-caps mb-3">Pipeline Progress</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard icon="today" label="Today's Candidates" value={summary.todaysCandidates} accent="#7C3AED" />
          <StatCard icon="person_add" label="New" value={summary.newCandidates} accent="#64748B" onClick={() => goTo('New')} />
          <StatCard icon="thumb_up" label="Interested" value={summary.interested} accent="#10B981" onClick={() => goTo('Interested')} />
          <StatCard icon="app_registration" label="Registration Pending" value={summary.registrationPending} accent="#D97706" onClick={() => goTo('Registration Pending')} />
          <StatCard icon="event" label="Interview Scheduled" value={summary.interviewScheduled} accent="#7C3AED" onClick={() => goTo('Interview Scheduled')} />
          <StatCard icon="fact_check" label="Interview Completed" value={summary.interviewCompleted} accent="#4F46E5" onClick={() => goTo('Interview Completed')} />
        </div>
      </div>

      {/* Which recruiter is doing what — team leaders/admins only, scoped server-side to
          their own team (see /reports/recruiter-performance). */}
      {showRecruiterActivity && (
        <div className="bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#40484B] dark:text-slate-300 font-label-caps mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#7C3AED] text-base">groups</span>
            Recruiter Activity
          </h3>
          {recruiterActivity.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No recruiters on this team yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-[#E2E8F0] dark:border-slate-700">
                  <tr className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-label-caps">
                    <th className="p-2.5 pl-3">Recruiter</th>
                    <th className="p-2.5 text-center">Active Candidates</th>
                    <th className="p-2.5 text-center text-green-700 dark:text-green-400">Selected</th>
                    <th className="p-2.5 text-center text-red-600 dark:text-red-400">Rejected</th>
                    <th className="p-2.5 pr-3 text-center text-emerald-700 dark:text-emerald-400">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] dark:divide-slate-700">
                  {recruiterActivity.map(r => (
                    <tr key={r.recruiterId} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                      <td className="p-2.5 pl-3 font-semibold text-slate-800 dark:text-slate-200">{r.name}</td>
                      <td className="p-2.5 text-center font-data-mono">{r.activeCandidates}</td>
                      <td className="p-2.5 text-center font-data-mono font-bold text-green-700 dark:text-green-400">{r.selected}</td>
                      <td className="p-2.5 text-center font-data-mono font-bold text-red-600 dark:text-red-400">{r.rejected}</td>
                      <td className="p-2.5 pr-3 text-center font-data-mono font-bold text-emerald-700 dark:text-emerald-400">{r.joined}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#40484B] dark:text-slate-400 font-label-caps mb-3">Outcomes</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard icon="check_circle" label="Selected" value={summary.selected} accent="#16A34A" onClick={() => goTo('Selected')} />
          <StatCard icon="cancel" label="Rejected" value={summary.rejected} accent="#DC2626" onClick={() => goTo('Rejected')} />
          <StatCard icon="celebration" label="Joined" value={summary.joined} accent="#047857" onClick={() => goTo('Joined')} />
          <StatCard icon="percent" label="Conversion %" value={`${summary.conversionPct}%`} accent="#9333EA" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#40484B] dark:text-slate-300 font-label-caps mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#7C3AED] text-base">trending_up</span>
            Weekly Candidate Trend
          </h3>
          <WeeklyTrendChart data={trend} />
        </div>
        <div className="bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#40484B] dark:text-slate-300 font-label-caps mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#7C3AED] text-base">filter_alt</span>
            Hiring Funnel
          </h3>
          <PipelineFunnelChart data={pipelineData} />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#40484B] dark:text-slate-300 font-label-caps mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#7C3AED] text-base">history</span>
          Recent Activities
        </h3>
        <RecentActivityTimeline activity={activity} />
      </div>
    </div>
  );
}
