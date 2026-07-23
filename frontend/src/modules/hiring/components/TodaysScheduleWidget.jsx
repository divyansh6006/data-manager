import React from 'react';
import EmptyState from '../../../shared/components/EmptyState';

export default function TodaysScheduleWidget({ interviews }) {
  if (!interviews || interviews.length === 0) return <EmptyState icon="event_available" message="No upcoming interviews scheduled." />;
  return (
    <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
      {interviews.map(iv => (
        <div key={iv.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#111C2D] dark:text-white truncate">{iv.candidate_name}</p>
            <p className="text-[10px] text-slate-500">{iv.round || 'Interview'} {iv.company_name ? `— ${iv.company_name}` : ''} · {iv.mode}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] font-bold font-data-mono text-[#7C3AED]">{iv.scheduled_date}</p>
            {iv.scheduled_time && <p className="text-[10px] text-slate-400">{iv.scheduled_time}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
