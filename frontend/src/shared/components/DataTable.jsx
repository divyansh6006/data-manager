import React from 'react';
import EmptyState from './EmptyState';
import SkeletonLoader from './SkeletonLoader';

// Generalizes the sticky-header/search/filter table shape repeated throughout
// CounselorDashboard.jsx/ManagerDashboard.jsx into one reusable component.
// columns: [{ key, label, render?: (row) => node, className? }]
export default function DataTable({ columns, rows, loading, emptyMessage = 'No records found.', onRowClick, keyField = 'id' }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-50 dark:bg-slate-900 border-b border-[#CBD5E1] dark:border-slate-700 text-[10px] font-bold text-[#505F76] dark:text-slate-400 uppercase tracking-wider font-label-caps">
            {columns.map(col => (
              <th key={col.key} className={`px-4 py-3 ${col.className || ''}`}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E2E8F0] dark:divide-slate-700">
          {loading ? (
            <tr><td colSpan={columns.length} className="p-0"><SkeletonLoader rows={5} /></td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="p-0"><EmptyState message={emptyMessage} /></td></tr>
          ) : (
            rows.map(row => (
              <tr
                key={row[keyField]}
                className={`hover-table-row transition ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={() => onRowClick && onRowClick(row)}
              >
                {columns.map(col => (
                  <td key={col.key} className={`px-4 py-3 text-[#111C2D] dark:text-slate-200 ${col.className || ''}`}>
                    {col.render ? col.render(row) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
