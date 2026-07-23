import React from 'react';
import EmptyState from '../../../shared/components/EmptyState';

export default function RecentActivityTimeline({ activity }) {
  if (!activity || activity.length === 0) return <EmptyState icon="history" message="No recent activity." />;
  return (
    <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
      {activity.map(a => (
        <div key={a.id} className="border-l-2 border-violet-200 dark:border-violet-800 pl-3 py-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase text-[#7C3AED]">{a.action.replace(/_/g, ' ')}</span>
            <span className="text-[10px] text-slate-400 font-data-mono shrink-0">
              {new Date(a.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5"><strong>{a.candidate_name}</strong> — {a.remark}</p>
          {a.recruiter_name && <p className="text-[10px] text-slate-400">by {a.recruiter_name}</p>}
        </div>
      ))}
    </div>
  );
}
