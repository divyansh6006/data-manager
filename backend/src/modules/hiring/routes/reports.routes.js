const express = require('express');
const db = require('../../../db');
const { requireRole } = require('../../../auth');
const { applyHiringScope } = require('../lib/reportHelpers');

const router = express.Router();
const REPORT_ROLES = ['super_admin', 'hiring_team_leader', 'recruiter'];

// GET /api/hiring/reports/recruiter-performance
router.get('/reports/recruiter-performance', requireRole(REPORT_ROLES), async (req, res) => {
  try {
    let recruiterQuery = db('users').where({ role: 'recruiter', active: true });
    if (req.user.role === 'hiring_team_leader') {
      if (!req.user.hiring_team_id) return res.json([]);
      recruiterQuery = recruiterQuery.where({ hiring_team_id: req.user.hiring_team_id });
    } else if (req.user.role === 'recruiter') {
      recruiterQuery = recruiterQuery.where({ id: req.user.id });
    }
    const recruiters = await recruiterQuery;
    const recruiterIds = recruiters.map(r => r.id);
    if (recruiterIds.length === 0) return res.json([]);

    const activeCounts = await db('hiring_candidate_assignments').whereIn('recruiter_id', recruiterIds)
      .groupBy('recruiter_id').select('recruiter_id').count('id as active');
    const closureCounts = await db('hiring_closures').whereIn('recruiter_id', recruiterIds)
      .groupBy('recruiter_id', 'final_status').select('recruiter_id', 'final_status').count('id as count');

    const activeMap = {};
    activeCounts.forEach(a => { activeMap[a.recruiter_id] = parseInt(a.active, 10); });
    const closureMap = {};
    closureCounts.forEach(c => {
      if (!closureMap[c.recruiter_id]) closureMap[c.recruiter_id] = {};
      closureMap[c.recruiter_id][c.final_status] = parseInt(c.count, 10);
    });

    res.json(recruiters.map(r => ({
      recruiterId: r.id, name: r.name,
      activeCandidates: activeMap[r.id] || 0,
      selected: (closureMap[r.id] && closureMap[r.id]['Selected']) || 0,
      rejected: (closureMap[r.id] && closureMap[r.id]['Rejected']) || 0,
      joined: (closureMap[r.id] && closureMap[r.id]['Joined']) || 0
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch recruiter performance report' });
  }
});

// GET /api/hiring/reports/candidate-source
router.get('/reports/candidate-source', requireRole(REPORT_ROLES), async (req, res) => {
  try {
    // Unlike every other report endpoint in this file, this one had no role scoping at all —
    // a recruiter or hiring_team_leader got the entire company's candidate-source breakdown.
    // Scope via a COALESCE-style join against both assignments (active) and closures (closed),
    // same safe pattern as buildMasterQuery() in candidates.routes.js — a candidate can only
    // ever have one or the other, so this never fans out into duplicate rows per candidate.
    let query = db('hiring_candidates')
      .leftJoin('hiring_candidate_assignments', 'hiring_candidates.id', 'hiring_candidate_assignments.candidate_id')
      .leftJoin('hiring_closures', 'hiring_candidates.id', 'hiring_closures.candidate_id')
      .whereNotNull('hiring_candidates.source');

    if (req.user.role === 'recruiter') {
      query = query.where(function () {
        this.where('hiring_candidate_assignments.recruiter_id', req.user.id)
          .orWhere('hiring_closures.recruiter_id', req.user.id);
      });
    } else if (req.user.role === 'hiring_team_leader') {
      if (!req.user.hiring_team_id) return res.json([]);
      const teamRecruiterIds = db('users').where({ hiring_team_id: req.user.hiring_team_id, role: 'recruiter' }).select('id');
      query = query.where(function () {
        this.whereIn('hiring_candidate_assignments.recruiter_id', teamRecruiterIds)
          .orWhereIn('hiring_closures.recruiter_id', teamRecruiterIds);
      });
    } else if (req.query.recruiterId) {
      query = query.where(function () {
        this.where('hiring_candidate_assignments.recruiter_id', req.query.recruiterId)
          .orWhere('hiring_closures.recruiter_id', req.query.recruiterId);
      });
    }

    const rows = await query
      .groupBy('hiring_candidates.source')
      .select('hiring_candidates.source as source')
      .count('hiring_candidates.id as count');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch candidate source report' });
  }
});

// GET /api/hiring/reports/interview-ratio — scheduled vs total assigned
router.get('/reports/interview-ratio', requireRole(REPORT_ROLES), async (req, res) => {
  try {
    const total = await applyHiringScope(db('hiring_candidate_assignments'), req.user, { filterRecruiterId: req.query.recruiterId }).count('id as c').first();
    const scheduled = await applyHiringScope(db('hiring_candidate_assignments'), req.user, { filterRecruiterId: req.query.recruiterId }).where('interview_scheduled', true).count('id as c').first();
    const totalCount = parseInt(total.c, 10);
    const scheduledCount = parseInt(scheduled.c, 10);
    res.json({ total: totalCount, scheduled: scheduledCount, ratio: totalCount > 0 ? Math.round((scheduledCount / totalCount) * 1000) / 10 : 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch interview ratio report' });
  }
});

// GET /api/hiring/reports/selection-ratio — Selected vs total interviewed
router.get('/reports/selection-ratio', requireRole(REPORT_ROLES), async (req, res) => {
  try {
    const closuresQuery = () => applyHiringScope(db('hiring_closures'), req.user, { filterRecruiterId: req.query.recruiterId });
    const totalClosed = await closuresQuery().count('id as c').first();
    const selected = await closuresQuery().where('final_status', 'Selected').count('id as c').first();
    const totalCount = parseInt(totalClosed.c, 10);
    const selectedCount = parseInt(selected.c, 10);
    res.json({ totalClosed: totalCount, selected: selectedCount, ratio: totalCount > 0 ? Math.round((selectedCount / totalCount) * 1000) / 10 : 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch selection ratio report' });
  }
});

// GET /api/hiring/reports/joining-ratio — Joined vs Selected
router.get('/reports/joining-ratio', requireRole(REPORT_ROLES), async (req, res) => {
  try {
    const closuresQuery = () => applyHiringScope(db('hiring_closures'), req.user, { filterRecruiterId: req.query.recruiterId });
    const selected = await closuresQuery().where('final_status', 'Selected').count('id as c').first();
    const joined = await closuresQuery().where('final_status', 'Joined').count('id as c').first();
    const selectedCount = parseInt(selected.c, 10);
    const joinedCount = parseInt(joined.c, 10);
    const base = selectedCount + joinedCount;
    res.json({ selected: selectedCount, joined: joinedCount, ratio: base > 0 ? Math.round((joinedCount / base) * 1000) / 10 : 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch joining ratio report' });
  }
});

// GET /api/hiring/reports/avg-response-time — assigned_at -> first activity log entry
router.get('/reports/avg-response-time', requireRole(REPORT_ROLES), async (req, res) => {
  try {
    const assignments = await applyHiringScope(db('hiring_candidate_assignments'), req.user, { filterRecruiterId: req.query.recruiterId })
      .select('candidate_id', 'recruiter_id', 'assigned_at');
    if (assignments.length === 0) return res.json({ avgResponseMinutes: 0, sampleSize: 0 });

    const candidateIds = assignments.map(a => a.candidate_id);
    const firstLogs = await db('hiring_activity_log')
      .whereIn('candidate_id', candidateIds)
      .whereNot('action', 'assign')
      .groupBy('candidate_id')
      .select('candidate_id')
      .min('timestamp as first_action_at');

    const logMap = {};
    firstLogs.forEach(l => { logMap[l.candidate_id] = l.first_action_at; });

    let totalMinutes = 0, count = 0;
    assignments.forEach(a => {
      const firstAction = logMap[a.candidate_id];
      if (firstAction) {
        const diffMs = new Date(firstAction) - new Date(a.assigned_at);
        if (diffMs >= 0) { totalMinutes += diffMs / 60000; count += 1; }
      }
    });

    res.json({ avgResponseMinutes: count > 0 ? Math.round(totalMinutes / count) : 0, sampleSize: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch average response time report' });
  }
});

// GET /api/hiring/reports/followup-performance — completed vs overdue
router.get('/reports/followup-performance', requireRole(REPORT_ROLES), async (req, res) => {
  try {
    let query = db('hiring_follow_ups');
    if (req.user.role === 'recruiter') {
      query = query.where('recruiter_id', req.user.id);
    } else if (req.user.role === 'hiring_team_leader') {
      if (!req.user.hiring_team_id) return res.json({ completed: 0, overdue: 0, pending: 0 });
      const teamRecruiterIds = db('users').where({ hiring_team_id: req.user.hiring_team_id, role: 'recruiter' }).select('id');
      query = query.whereIn('recruiter_id', teamRecruiterIds);
      if (req.query.recruiterId) query = query.where('recruiter_id', req.query.recruiterId);
    } else if (req.query.recruiterId) {
      query = query.where('recruiter_id', req.query.recruiterId);
    }

    const completed = await query.clone().where('completed', true).count('id as c').first();
    const now = new Date();
    const overdue = await query.clone().where('completed', false).where('follow_up_date', '<', now).count('id as c').first();
    const pending = await query.clone().where('completed', false).where('follow_up_date', '>=', now).count('id as c').first();

    res.json({ completed: parseInt(completed.c, 10), overdue: parseInt(overdue.c, 10), pending: parseInt(pending.c, 10) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch follow-up performance report' });
  }
});

// GET /api/hiring/reports/daily-calls — action='call' rows per day/recruiter
router.get('/reports/daily-calls', requireRole(REPORT_ROLES), async (req, res) => {
  try {
    let query = db('hiring_activity_log').where('action', 'call');
    if (req.user.role === 'recruiter') {
      query = query.where('recruiter_id', req.user.id);
    } else if (req.user.role === 'hiring_team_leader') {
      if (!req.user.hiring_team_id) return res.json([]);
      const teamRecruiterIds = db('users').where({ hiring_team_id: req.user.hiring_team_id, role: 'recruiter' }).select('id');
      query = query.whereIn('recruiter_id', teamRecruiterIds);
      if (req.query.recruiterId) query = query.where('recruiter_id', req.query.recruiterId);
    } else if (req.query.recruiterId) {
      query = query.where('recruiter_id', req.query.recruiterId);
    }
    const rows = await query.select('recruiter_id', 'timestamp');
    const byDay = {};
    rows.forEach(r => {
      const day = new Date(r.timestamp).toISOString().slice(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
    });
    res.json(Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch daily calls report' });
  }
});

// GET /api/hiring/reports/pipeline — full funnel breakdown
router.get('/reports/pipeline', requireRole(REPORT_ROLES), async (req, res) => {
  try {
    const rows = await applyHiringScope(db('hiring_candidate_assignments'), req.user, { filterRecruiterId: req.query.recruiterId })
      .groupBy('pipeline_status').select('pipeline_status').count('id as count');
    const closureRows = await applyHiringScope(db('hiring_closures'), req.user, { filterRecruiterId: req.query.recruiterId })
      .groupBy('final_status').select('final_status').count('id as count');
    res.json({
      active: rows.map(r => ({ status: r.pipeline_status, count: parseInt(r.count, 10) })),
      closed: closureRows.map(r => ({ status: r.final_status, count: parseInt(r.count, 10) }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch pipeline report' });
  }
});

module.exports = router;
