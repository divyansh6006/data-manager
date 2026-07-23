import React from 'react';

export default function EmptyState({ icon = 'inbox', title, message = 'Nothing here yet.' }) {
  return (
    <div className="p-12 text-center">
      <span className="material-symbols-outlined text-4xl text-[#CBD5E1] dark:text-slate-600 block mb-3">{icon}</span>
      {title && <p className="text-sm font-semibold text-[#40484B] dark:text-slate-300 mb-1">{title}</p>}
      <p className="text-xs text-[#70787C] dark:text-slate-400 italic">{message}</p>
    </div>
  );
}
