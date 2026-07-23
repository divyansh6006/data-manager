import React from 'react';

// Same wordmark as SkillLabsLogo (LoginView.jsx/SuperAdminDashboard.jsx) plus a small
// "HIRING" workspace tag in the violet accent, so the workspace is visually identifiable
// at a glance without looking like a separate application.
export default function HiringLogo({ className = '' }) {
  return (
    <div className="flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 50" className={className}>
        <text x="0" y="38" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="800" fontSize="38" fill="#1BACE4" letterSpacing="-1.5">Skill</text>
        <text x="92" y="38" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="300" fontSize="38" fill="#F7941D" letterSpacing="-1.5">Labs</text>
      </svg>
      <span className="text-[9px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#7C3AED] text-white">Hiring</span>
    </div>
  );
}
