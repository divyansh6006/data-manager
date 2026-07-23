import React from 'react';

// KPI tile — modeled on the summary cards hand-rolled in ManagerDashboard.jsx/
// SuperAdminDashboard.jsx (icon + label + big number + optional sub-line/trend).
export default function StatCard({ icon, label, value, accent = '#7C3AED', sub, onClick, active = false }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`text-left bg-white dark:bg-slate-800 border rounded-xl p-4 shadow-sm transition hover-card-lift ${onClick ? 'cursor-pointer' : ''}`}
      style={{ borderColor: active ? accent : undefined, boxShadow: active ? `0 0 0 2px ${accent}33` : undefined }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {icon && (
          <span className="material-symbols-outlined text-base" style={{ color: accent }}>{icon}</span>
        )}
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#70787C] dark:text-slate-400 font-label-caps">{label}</span>
      </div>
      <div className="text-2xl font-bold font-data-mono text-[#111C2D] dark:text-white">{value}</div>
      {sub && <div className="text-[10px] text-[#70787C] dark:text-slate-400 mt-1">{sub}</div>}
    </Tag>
  );
}
