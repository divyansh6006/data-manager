import React from 'react';

// Renders the toast stack — modeled on the identical markup duplicated across all 4
// existing dashboards (see CounselorDashboard.jsx ~3091-3112).
export default function ToastContainer({ toasts }) {
  return (
    <div className="fixed top-5 right-5 z-[10000] flex flex-col items-end pointer-events-none">
      {toasts.map(t => {
        const style = t.type === 'success'
          ? { icon: 'check_circle', bg: '#0C2340', accent: '#10B981' }
          : t.type === 'error'
            ? { icon: 'error', bg: '#0C2340', accent: '#EF4444' }
            : t.type === 'warning'
              ? { icon: 'warning', bg: '#0C2340', accent: '#F59E0B' }
              : { icon: 'info', bg: '#0C2340', accent: '#7C3AED' };
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2.5 pl-3 pr-4 py-3 rounded-lg shadow-2xl text-white text-xs font-semibold max-w-[320px] border-l-4 ${t.closing ? 'animate-toast-out' : 'animate-toast-in'}`}
            style={{ background: style.bg, borderColor: style.accent }}
          >
            <span className="material-symbols-outlined text-lg" style={{ color: style.accent }}>{style.icon}</span>
            <span className="leading-snug">{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
