import React from 'react';

export default function SettingsPage({ user, isDark, onToggleDark }) {
  return (
    <div className="space-y-4 max-w-xl">
      <div className="bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#40484B] dark:text-slate-300 font-label-caps mb-4">Profile</h3>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between"><span className="text-slate-500">Name</span><span className="font-semibold">{user.name}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Email</span><span className="font-data-mono">{user.email}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Role</span><span className="font-semibold capitalize">{user.role.replace(/_/g, ' ')}</span></div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#40484B] dark:text-slate-300 font-label-caps mb-4">Appearance</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#111C2D] dark:text-white">Dark Mode</p>
            <p className="text-[10px] text-slate-400">Applies to the Hiring workspace only.</p>
          </div>
          <button
            onClick={onToggleDark}
            className={`w-12 h-6 rounded-full relative transition ${isDark ? 'bg-[#7C3AED]' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isDark ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
