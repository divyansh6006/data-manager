// Small aggregation helpers for the Hiring reports, styled after computeDataReport() /
// getPeriodRange() in backend/src/index.js — no new aggregation paradigm, same UTC-day-
// boundary convention so "today"/"this week" mean the same thing across both workspaces.

const db = require('../../../db');

function serializeDate(date) {
  if (!date) return null;
  const isSqlite = db.client.config.client === 'sqlite3';
  return isSqlite ? (date instanceof Date ? date.getTime() : new Date(date).getTime()) : date;
}

// IST-aware day boundaries, used only by the Daily Tracker endpoint — deliberately NOT used
// by getPeriodRange()/the rest of this file, which stay UTC-based to match the existing
// trend/report endpoints. Copied from getISTDateString()/getISTDayRange() in
// backend/src/index.js, where they're load-bearing for the identical Leads-workspace feature
// (a pure-UTC "today" is wrong for up to 5.5 hours around every IST midnight).
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getISTDateString(date = new Date()) {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function getISTDayRange(dateStr) {
  return {
    start: new Date(`${dateStr}T00:00:00.000+05:30`),
    end: new Date(`${dateStr}T23:59:59.999+05:30`)
  };
}

// Resolve a 'today' | 'week' | 'month' | 'all' shorthand into a concrete UTC date range.
// Deliberately identical logic to getPeriodRange() in index.js.
function getPeriodRange(period) {
  const now = new Date();
  if (period === 'today') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    return { start, end };
  }
  if (period === 'week') {
    const dayOfWeek = now.getUTCDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday, 0, 0, 0, 0));
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    sunday.setUTCHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
  }
  if (period === 'month') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    return { start, end };
  }
  return null;
}

// Apply the standard recruiter/team-leader/super_admin scoping rule to a query on a table
// that has its own recruiter_id column (hiring_candidate_assignments, hiring_closures) —
// recruiter sees only their own candidates, hiring_team_leader sees their team's,
// super_admin sees everything unless a specific recruiterId/teamId filter is passed.
// Pass recruiterIdCol explicitly (e.g. 'alias.recruiter_id') only when the query joins in
// a table under a different name than its own — bare 'recruiter_id' is correct whenever
// the query's base FROM table is the one being scoped, which is every current call site.
function applyHiringScope(query, user, { recruiterIdCol = 'recruiter_id', filterRecruiterId, filterTeamId } = {}) {
  if (user.role === 'recruiter') {
    return query.where(recruiterIdCol, user.id);
  }
  if (user.role === 'hiring_team_leader') {
    const teamRecruiterIds = db('users').where({ hiring_team_id: user.hiring_team_id, role: 'recruiter' }).select('id');
    query = query.whereIn(recruiterIdCol, teamRecruiterIds);
    // Previously filterRecruiterId was only ever read in the super_admin branch below, so a
    // team leader narrowing the "All Recruiters" dropdown to one of their own recruiters got
    // whole-team dashboard/report numbers back instead of that recruiter's — the exact
    // "counts don't match what's on screen" symptom. Safe-by-construction: if
    // filterRecruiterId isn't on this team, the whereIn above already excludes it.
    if (filterRecruiterId) query = query.where(recruiterIdCol, filterRecruiterId);
    return query;
  }
  // super_admin — unrestricted unless explicitly filtered
  if (filterRecruiterId) return query.where(recruiterIdCol, filterRecruiterId);
  if (filterTeamId) {
    const teamRecruiterIds = db('users').where({ hiring_team_id: filterTeamId, role: 'recruiter' }).select('id');
    return query.whereIn(recruiterIdCol, teamRecruiterIds);
  }
  return query;
}

module.exports = { serializeDate, getPeriodRange, applyHiringScope, getISTDateString, getISTDayRange };
