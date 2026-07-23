const express = require('express');
const db = require('../../../db');
const { requireRole } = require('../../../auth');
const { HIRING_STATUSES, TERMINAL_HIRING_STATUSES } = require('../lib/pipeline');
const { applyHiringScope, serializeDate, getISTDateString, getISTDayRange } = require('../lib/reportHelpers');

const router = express.Router();

const ACTIVE_STATUSES = HIRING_STATUSES.filter(s => !TERMINAL_HIRING_STATUSES.includes(s));

// GET /api/hiring/daily-tracking?date=YYYY-MM-DD&recruiterId=
// Mirrors GET /api/leads/daily-tracking (backend/src/index.js) for the Hiring workspace:
// what happened to which candidates on a given IST calendar day, bucketed by pipeline_status,
// with closures (Selected/Rejected/Joined/Closed) surfaced separately since closing a
// candidate deletes their hiring_candidate_assignments row.
router.get('/daily-tracking', requireRole(['super_admin', 'hiring_team_leader', 'recruiter']), async (req, res) => {
  const { date, recruiterId } = req.query;
  const targetDate = date || getISTDateString();
  const { start: dayStart, end: dayEnd } = getISTDayRange(targetDate);

  if (req.user.role === 'hiring_team_leader' && !req.user.hiring_team_id) {
    return res.json({
      date: targetDate,
      summary: { total: 0, byStatus: {}, closed: 0 },
      categories: { closed: [], all: [] }
    });
  }

  try {
    let query = db('hiring_candidate_assignments')
      .join('hiring_candidates', 'hiring_candidate_assignments.candidate_id', 'hiring_candidates.id')
      .join('users as recruiter', 'hiring_candidate_assignments.recruiter_id', 'recruiter.id')
      .select(
        'hiring_candidates.*',
        'hiring_candidate_assignments.pipeline_status',
        'hiring_candidate_assignments.registration_status',
        'hiring_candidate_assignments.interview_scheduled',
        'hiring_candidate_assignments.result_status',
        'hiring_candidate_assignments.status_remark',
        'hiring_candidate_assignments.not_contactable_reason',
        'hiring_candidate_assignments.assigned_at',
        'hiring_candidate_assignments.updated_at as assignment_updated_at',
        'hiring_candidate_assignments.recruiter_id',
        'recruiter.name as recruiter_name'
      );
    query = applyHiringScope(query, req.user, { filterRecruiterId: recruiterId });

    const candidates = await query;
    const candidateIds = candidates.map(c => c.id);

    let activityLogs = [];
    if (candidateIds.length > 0) {
      activityLogs = await db('hiring_activity_log')
        .whereIn('candidate_id', candidateIds)
        // Exclude 'assign' — auto-logged the moment a candidate is allocated to a
        // recruiter, not an actual recruiter touch. Mirrors the identical exclusion of
        // 'distributed' in the Leads workspace's daily-tracking/data-report endpoints.
        .whereNot('action', 'assign')
        .where('timestamp', '>=', serializeDate(dayStart))
        .where('timestamp', '<=', serializeDate(dayEnd))
        .select('candidate_id', 'action', 'remark', 'timestamp');
    }
    const activeCandidateIds = new Set(activityLogs.map(l => l.candidate_id));

    const filtered = candidates.filter(c => {
      // Knex/SQLite returns timestamp columns as plain strings, not Date instances (unlike
      // node-postgres, which auto-parses them) — comparing a string to a Date with >=/<= coerces
      // the string via ToNumber, which is always NaN, so both checks were silently always false
      // on the dev/SQLite database. Wrapping both sides in `new Date(...)` makes the comparison
      // correct on both backends.
      const createdOnDate = new Date(c.created_at) >= dayStart && new Date(c.created_at) <= dayEnd;
      const assignmentUpdatedOnDate = new Date(c.assignment_updated_at) >= dayStart && new Date(c.assignment_updated_at) <= dayEnd;
      return createdOnDate || assignmentUpdatedOnDate || activeCandidateIds.has(c.id);
    });

    // Bucket dynamically by whatever pipeline_status values actually occur today, ordered
    // per HIRING_STATUSES rather than a hardcoded switch/case — Hiring has 11 active statuses
    // vs Leads' 6, so a fixed bucket list would either miss statuses or need constant upkeep.
    const categories = {};
    ACTIVE_STATUSES.forEach(s => { categories[s] = []; });
    categories.all = [];
    const byStatus = {};

    filtered.forEach(c => {
      const entry = {
        ...c,
        touchedToday: activeCandidateIds.has(c.id),
        activity_today: activityLogs.filter(a => a.candidate_id === c.id)
      };
      categories.all.push(entry);
      const bucket = categories[c.pipeline_status] || (categories[c.pipeline_status] = []);
      bucket.push(entry);
      byStatus[c.pipeline_status] = (byStatus[c.pipeline_status] || 0) + 1;
    });

    // Closures — joined directly off hiring_closures (not candidateIds), since closing a
    // candidate deletes their hiring_candidate_assignments row, so a candidate closed today
    // is never in `candidates` above. Mirrors the identical closures-join pattern in
    // GET /api/leads/daily-tracking (backend/src/index.js).
    let closuresQuery = db('hiring_closures')
      .join('hiring_candidates', 'hiring_closures.candidate_id', 'hiring_candidates.id')
      .join('users as recruiter', 'hiring_closures.recruiter_id', 'recruiter.id')
      .whereIn('hiring_closures.final_status', TERMINAL_HIRING_STATUSES)
      .where('hiring_closures.closed_at', '>=', serializeDate(dayStart))
      .where('hiring_closures.closed_at', '<=', serializeDate(dayEnd))
      .select(
        'hiring_candidates.*',
        'hiring_closures.final_status',
        'hiring_closures.drop_stage',
        'hiring_closures.drop_remark',
        'hiring_closures.closed_at',
        'hiring_closures.recruiter_id',
        'recruiter.name as recruiter_name'
      );
    closuresQuery = applyHiringScope(closuresQuery, req.user, { recruiterIdCol: 'hiring_closures.recruiter_id', filterRecruiterId: recruiterId });
    const closedToday = await closuresQuery;

    const closedIds = closedToday.map(c => c.id);
    let closedActivity = [];
    if (closedIds.length > 0) {
      closedActivity = await db('hiring_activity_log')
        .whereIn('candidate_id', closedIds)
        .whereNot('action', 'assign')
        .where('timestamp', '>=', serializeDate(dayStart))
        .where('timestamp', '<=', serializeDate(dayEnd))
        .select('candidate_id', 'action', 'remark', 'timestamp');
    }
    categories.closed = closedToday.map(c => ({
      ...c,
      activity_today: closedActivity.filter(a => a.candidate_id === c.id)
    }));

    res.json({
      date: targetDate,
      summary: { total: filtered.length, byStatus, closed: categories.closed.length },
      categories
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch daily tracking data' });
  }
});

module.exports = router;
