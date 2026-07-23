import React from 'react';
import useKeyboardShortcut from '../hooks/useKeyboardShortcut';

// Right-side slide-over — generalizes ManagerDashboard.jsx's existing lead-detail drawer
// (~line 2150) into a reusable shell. Candidate detail in Hiring is drawer-based from day
// one rather than modal-based — see the Hiring module implementation plan for why this is
// a load-bearing choice, not a stylistic one.
export default function Drawer({ title, subtitle, onClose, children, width = 'w-[450px]' }) {
  useKeyboardShortcut('Escape', onClose);

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-30 z-40" onClick={onClose} />
      <div className={`fixed inset-y-0 right-0 z-50 ${width} bg-white dark:bg-slate-800 border-l border-[#CBD5E1] dark:border-slate-700 shadow-2xl flex flex-col h-screen animate-fade-in`}>
        <div className="p-4 border-b border-[#E2E8F0] dark:border-slate-700 flex items-center justify-between bg-[#F8FAFC] dark:bg-slate-900 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[#111C2D] dark:text-white font-headline-md truncate">{title}</h3>
            {subtitle && <p className="text-[11px] text-[#70787C] dark:text-slate-400 font-data-mono truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#70787C] hover:text-[#111C2D] dark:hover:text-white rounded hover:bg-[#E2E8F0] dark:hover:bg-slate-700 flex items-center shrink-0"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-grow p-4 overflow-y-auto space-y-6">
          {children}
        </div>
      </div>
    </>
  );
}
