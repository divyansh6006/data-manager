import React from 'react';
import useKeyboardShortcut from '../hooks/useKeyboardShortcut';

// Generic centered dialog — generalizes the overlay+card+header/body/footer structure of
// frontend/src/components/RemarksModal.jsx into a reusable shell any Hiring form/confirm
// dialog can plug content into.
export default function Modal({ title, icon, onClose, children, footer, maxWidth = 'max-w-lg' }) {
  useKeyboardShortcut('Escape', onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4" onClick={onClose}>
      <div
        className={`w-full ${maxWidth} bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded shadow-lg animate-fade-in max-h-[85vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[#CBD5E1] dark:border-slate-700 flex items-center justify-between shrink-0">
          <h3 className="text-sm font-bold text-[#111C2D] dark:text-white flex items-center gap-1.5">
            {icon && <span className="material-symbols-outlined text-[#7C3AED]">{icon}</span>}
            <span>{title}</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3 flex-grow">
          {children}
        </div>

        {footer && (
          <div className="p-3 border-t border-[#CBD5E1] dark:border-slate-700 flex justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
