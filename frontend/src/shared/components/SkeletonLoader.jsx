import React from 'react';

// Simple pulsing placeholder rows/blocks — used on the two highest-traffic Hiring views
// (dashboard + candidates list) in Phase 1; a full skeleton pass across every view is
// Phase 2 polish.
export default function SkeletonLoader({ rows = 4 }) {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-8 bg-slate-100 dark:bg-slate-700 rounded" style={{ width: `${85 - (i % 3) * 10}%` }} />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl p-4 animate-pulse">
      <div className="h-3 w-20 bg-slate-100 dark:bg-slate-700 rounded mb-3" />
      <div className="h-6 w-14 bg-slate-100 dark:bg-slate-700 rounded" />
    </div>
  );
}
