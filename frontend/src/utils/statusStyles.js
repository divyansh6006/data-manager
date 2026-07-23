/**
 * Single source of truth for the flat counseling-status styling, shared across the
 * Counselor, Manager, and Team Leader dashboards so the badge/dot/select colors always
 * agree everywhere a status is shown or edited.
 */

export const COUNSELING_STATUSES = ['Not Contacted', 'Interested', 'Call Back', 'Cold', 'Not Interested', 'Not Contactable', 'Lead Punched', 'Duplicate Lead', 'Job Seeker'];
export const NOT_CONTACTABLE_REASONS = ['Switch Off', 'Out of Coverage', 'Not Picked', 'Call Fail', 'Wrong Number', 'Others'];
export const FEE_PAYMENT_STATUSES = ['None', 'Partial', 'Full'];
export const REGISTRATION_STATUSES = ['Not Registered', 'Registered'];
export const TERMINAL_STATUSES = ['Not Interested', 'Duplicate Lead', 'Job Seeker'];

export const STATUS_STYLES = {
  'Not Contacted':  { color: '#64748B', dot: 'bg-slate-400',                badge: 'bg-slate-100 text-slate-700 border border-slate-300',  select: 'text-slate-700 bg-slate-100 border-slate-300' },
  'Interested':     { color: '#10B981', dot: 'bg-green-500 animate-pulse',  badge: 'bg-green-50 text-green-700 border border-green-200',    select: 'text-green-700 bg-green-50/50 border-green-200' },
  'Call Back':      { color: '#0D9488', dot: 'bg-teal-500 animate-pulse',   badge: 'bg-teal-50 text-teal-700 border border-teal-200',        select: 'text-teal-700 bg-teal-50/50 border-teal-200' },
  'Cold':           { color: '#94A3B8', dot: 'bg-slate-300',               badge: 'bg-slate-100 text-slate-500 border border-slate-300',    select: 'text-slate-500 bg-slate-100/50 border-slate-300' },
  'Not Interested': { color: '#EF4444', dot: 'bg-red-500',                 badge: 'bg-red-50 text-red-700 border border-red-200',          select: 'text-red-700 bg-red-50/50 border-red-200' },
  'Not Contactable':{ color: '#F59E0B', dot: 'bg-amber-500',               badge: 'bg-amber-50 text-amber-700 border border-amber-200',    select: 'text-amber-700 bg-amber-50/50 border-amber-200' },
  'Lead Punched':   { color: '#1BACE4', dot: 'bg-sky-500',                 badge: 'bg-sky-50 text-sky-700 border border-sky-200',          select: 'text-sky-700 bg-sky-50/50 border-sky-200' },
  'Duplicate Lead': { color: '#8B5CF6', dot: 'bg-violet-500',              badge: 'bg-violet-50 text-violet-700 border border-violet-200', select: 'text-violet-700 bg-violet-50/50 border-violet-200' },
  'Job Seeker':     { color: '#FB923C', dot: 'bg-orange-400',              badge: 'bg-orange-50 text-orange-700 border border-orange-200', select: 'text-orange-700 bg-orange-50/50 border-orange-200' }
};
const DEFAULT_STATUS_STYLE = { color: '#111C2D', dot: 'bg-blue-400', badge: 'bg-slate-50 text-slate-500', select: 'text-slate-600' };
export const getStatusStyle = (status) => STATUS_STYLES[status] || DEFAULT_STATUS_STYLE;

export const FEE_STATUS_STYLES = {
  'None':    { badge: 'bg-slate-100 text-slate-600 border border-slate-300' },
  'Partial': { badge: 'bg-amber-50 text-amber-700 border border-amber-200' },
  'Full':    { badge: 'bg-green-50 text-green-700 border border-green-200' }
};
export const getFeeStatusStyle = (status) => FEE_STATUS_STYLES[status] || FEE_STATUS_STYLES['None'];

// FA/CF chip — derived client-side from assigned_at vs today, no backend flag needed.
// Compares IST calendar-date parts, NOT UTC or local-browser ones — this must stay
// byte-for-byte consistent with the backend's getPeriodRange('today') (backend/src/index.js),
// which buckets "today" by IST (the business's actual timezone), not UTC. Comparing UTC (or
// local-browser) date parts here would silently disagree with the backend for ~5.5 hours
// every day — a lead assigned right after IST midnight would still show as yesterday's
// Carry Forward here while the backend (Performance tab, Manager/Team Leader reports)
// already counted it as today's Fresh Allocation, or vice versa.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function toISTDateString(date) {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}
export function isFreshToday(assignedAt) {
  if (!assignedAt) return false;
  return toISTDateString(new Date(assignedAt)) === toISTDateString(new Date());
}

// 'YYYY-MM-DD' for today in IST — use this (not `new Date().toISOString().slice(0,10)`,
// which reads the UTC date) to default any date picker/filter that's meant to start on
// "today" as the backend defines it, for the same reason as isFreshToday above.
export function getTodayISTDateString() {
  return toISTDateString(new Date());
}
