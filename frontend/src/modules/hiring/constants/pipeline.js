// Hiring's own flat pipeline status model — entirely separate data/shape from
// frontend/src/utils/statusStyles.js (Admissions), per the module's data-isolation
// requirement. Mirrors backend/src/modules/hiring/lib/pipeline.js's HIRING_STATUSES.
export const HIRING_STATUSES = [
  'New', 'Contacted', 'Interested', 'Not Interested', 'Call Back', 'Not Contactable',
  'Registration Pending', 'Registration Completed', 'Interview Scheduled',
  'Interview Completed', 'Selected', 'Rejected', 'Offer Released', 'Joined', 'Closed'
];

// Sub-reason required when a candidate is marked 'Not Contactable' — mirrors Admissions'
// NOT_CONTACTABLE_REASONS (frontend/src/utils/statusStyles.js).
export const NOT_CONTACTABLE_REASONS = ['Switch Off', 'Out of Coverage', 'Not Picked', 'Call Fail', 'Wrong Number', 'Others'];

export const TERMINAL_HIRING_STATUSES = ['Selected', 'Rejected', 'Joined', 'Closed'];

export const PIPELINE_STYLES = {
  'New': { color: '#64748B', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-700 border border-slate-200' },
  'Contacted': { color: '#0284C7', dot: 'bg-sky-500', badge: 'bg-sky-50 text-sky-700 border border-sky-200' },
  'Interested': { color: '#10B981', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  'Not Interested': { color: '#EF4444', dot: 'bg-red-500', badge: 'bg-red-50 text-red-700 border border-red-200' },
  'Call Back': { color: '#0D9488', dot: 'bg-teal-500', badge: 'bg-teal-50 text-teal-700 border border-teal-200' },
  'Not Contactable': { color: '#F59E0B', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border border-amber-200' },
  'Registration Pending': { color: '#D97706', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border border-amber-200' },
  'Registration Completed': { color: '#059669', dot: 'bg-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  'Interview Scheduled': { color: '#7C3AED', dot: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700 border border-violet-200' },
  'Interview Completed': { color: '#4F46E5', dot: 'bg-indigo-500', badge: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
  'Selected': { color: '#16A34A', dot: 'bg-green-600', badge: 'bg-green-50 text-green-700 border border-green-200 font-extrabold' },
  'Rejected': { color: '#DC2626', dot: 'bg-red-600', badge: 'bg-red-50 text-red-700 border border-red-200 font-extrabold' },
  'Offer Released': { color: '#9333EA', dot: 'bg-purple-500', badge: 'bg-purple-50 text-purple-700 border border-purple-200' },
  'Joined': { color: '#047857', dot: 'bg-emerald-700', badge: 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold' },
  'Closed': { color: '#71717A', dot: 'bg-zinc-500', badge: 'bg-zinc-100 text-zinc-600 border border-zinc-200' }
};

export const DEFAULT_PIPELINE_STYLE = { color: '#70787C', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 border border-slate-200' };

export function getPipelineStyle(status) {
  return PIPELINE_STYLES[status] || DEFAULT_PIPELINE_STYLE;
}

export const REGISTRATION_STATUSES = ['Pending', 'Completed'];
export const INTERVIEW_MODES = ['Online', 'Offline'];
export const RESULT_STATUSES = ['Selected', 'Rejected', 'Pending'];
export const INTERVIEW_STATUSES = ['Scheduled', 'Completed', 'Cancelled', 'No-show'];
