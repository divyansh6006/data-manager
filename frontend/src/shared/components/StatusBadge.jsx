import React from 'react';

// Generalizes the getStatusStyle()/badge pattern from frontend/src/utils/statusStyles.js —
// takes a styleMap so any module (Hiring's own pipeline status map, or Admissions' if it
// ever adopts this) can plug in without a second component existing.
export default function StatusBadge({ status, styleMap, defaultStyle = { color: '#70787C', badge: 'bg-slate-100 text-slate-600 border border-slate-200' }, showDot = false }) {
  const style = (styleMap && styleMap[status]) || defaultStyle;
  return (
    <span className="inline-flex items-center gap-1.5">
      {showDot && <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot || 'bg-slate-400'}`} />}
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${style.badge}`}>{status}</span>
    </span>
  );
}
