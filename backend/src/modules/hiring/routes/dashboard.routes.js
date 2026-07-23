const express = require('express');
const db = require('../../../db');
const { requireRole } = require('../../../auth');
const { getPeriodRange, applyHiringScope } = require('../lib/reportHelpers');

const router = express.Router();

function scopedAssignments(user, recruiterId) {
  let query = db('hiring_candidate_assignments');
  return applyHiringScope(query, user, { recruiterIdCol: 'recruiter_id', filterRecruiterId: recruiterId });
}

function scopedClosures(user, recruiterId) {
  let query = db('hiring_closures');
  return applyHiringScope(query, user, { recruiterIdCol: 'recruiter_id', filterRecruiterId: recruiterId });
}

// GET /api/hiring/dashboard/summary — all the count cards + conversion %
router.get('/dashboard/summary', requireRole(['super_admin', 'hiring_team_leader', 'recruiter']), async (req, res) => {
  try {
    const { recruiterId } = req.query;
    const todayRange = getPeriodRange('today');

    const statusCounts = await scopedAssignments(req.user, recruiterId)
      .groupBy('pipeline_status').select('pipeline_status').count('id as count');
    const statusMap = {};
    statusCounts.forEach(s => { statusMap[s.pipeline_status] = parseInt(s.count, 10); });

    const todayCandidates = await scopedAssignments(req.user, recruiterId)
      .where('assigned_at', '>=', todayRange.start).where('assigned_at', '<=', todayRange.end)
      .count('id as c').first();

    const closureCounts = await scopedClosures(req.user, recruiterId)
      .groupBy('final_status').select('final_status').count('id as count');
    const closureMap = {};
    closureCounts.forEach(c => { closureMap[c.final_status] = parseInt(c.count, 10); });

    const totalActive = await scopedAssignments(req.user, recruiterId).count('id as c').first();
    const totalClosures = await scopedClosures(req.user, recruiterId).count('id as c').first();
    const totalEver = parseInt(totalActive.c, 10) + parseInt(totalClosures.c, 10);
    const joined = closureMap['Joined'] || 0;
    const conversionPct = totalEver > 0 ? Math.round((joined / totalEver) * 1000) / 10 : 0;

    res.json({
      todaysCandidates: parseInt(todayCandidates.c, 10),
      newCandidates: statusMap['New'] || 0,
      interested: statusMap['Interested'] || 0,
      registrationPending: statusMap['Registration Pending'] || 0,
      interviewScheduled: statusMap['Interview Scheduled'] || 0,
      interviewCompleted: statusMap['Interview Completed'] || 0,
      selected: closureMap['Selected'] || 0,
      rejected: closureMap['Rejected'] || 0,
      joined,
      conversionPct,
      totalActive: parseInt(totalActive.c, 10),
      statusBreakdown: statusMap
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

// GET /api/hiring/dashboard/trend?days=7 — Weekly Candidate Trend chart
router.get('/dashboard/trend', requireRole(['super_admin', 'hiring_team_leader', 'recruiter']), async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 7;
    const { recruiterId } = req.query;
    const rows = await scopedAssignments(req.user, recruiterId).select('assigned_at');

    const buckets = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = 0;
    }
    rows.forEach(r => {
      const key = new Date(r.assigned_at).toISOString().slice(0, 10);
      if (buckets[key] !== undefined) buckets[key] += 1;
    });

    res.json(Object.entries(buckets).map(([date, count]) => ({ date, count })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch trend data' });
  }
});

// GET /api/hiring/dashboard/activity — Recent Activities feed
router.get('/dashboard/activity', requireRole(['super_admin', 'hiring_team_leader', 'recruiter']), async (req, res) => {
  try {
    let query = db('hiring_activity_log')
      .join('hiring_candidates', 'hiring_activity_log.candidate_id', 'hiring_candidates.id')
      .leftJoin('users', 'hiring_activity_log.recruiter_id', 'users.id')
      .select('hiring_activity_log.*', 'hiring_candidates.name as candidate_name', 'users.name as recruiter_name');

    if (req.user.role === 'recruiter') {
      query = query.where('hiring_activity_log.recruiter_id', req.user.id);
    } else if (req.user.role === 'hiring_team_leader') {
      if (!req.user.hiring_team_id) return res.json([]);
      const teamRecruiterIds = db('users').where({ hiring_team_id: req.user.hiring_team_id, role: 'recruiter' }).select('id');
      query = query.whereIn('hiring_activity_log.recruiter_id', teamRecruiterIds);
    }

    const activity = await query.orderBy('timestamp', 'desc').limit(30);
    res.json(activity);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch activity feed' });
  }
});

// GET /api/hiring/dashboard/upcoming-interviews
router.get('/dashboard/upcoming-interviews', requireRole(['super_admin', 'hiring_team_leader', 'recruiter']), async (req, res) => {
  try {
    let query = db('hiring_interviews')
      .join('hiring_candidates', 'hiring_interviews.candidate_id', 'hiring_candidates.id')
      .leftJoin('hiring_candidate_assignments', 'hiring_interviews.candidate_id', 'hiring_candidate_assignments.candidate_id')
      .leftJoin('companies', 'hiring_interviews.company_id', 'companies.id')
      .where('hiring_interviews.status', 'Scheduled')
      .select('hiring_interviews.*', 'hiring_candidates.name as candidate_name', 'companies.name as company_name');

    if (req.user.role === 'recruiter') {
      query = query.where('hiring_candidate_assignments.recruiter_id', req.user.id);
    } else if (req.user.role === 'hiring_team_leader') {
      if (!req.user.hiring_team_id) return res.json([]);
      const teamRecruiterIds = db('users').where({ hiring_team_id: req.user.hiring_team_id, role: 'recruiter' }).select('id');
      query = query.whereIn('hiring_candidate_assignments.recruiter_id', teamRecruiterIds);
    }

    const interviews = await query.orderBy('hiring_interviews.scheduled_date', 'asc').limit(10);
    res.json(interviews);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch upcoming interviews' });
  }
});

// GET /api/hiring/dashboard/pending-followups
router.get('/dashboard/pending-followups', requireRole(['super_admin', 'hiring_team_leader', 'recruiter']), async (req, res) => {
  try {
    let query = db('hiring_follow_ups')
      .join('hiring_candidates', 'hiring_follow_ups.candidate_id', 'hiring_candidates.id')
      .where('hiring_follow_ups.completed', false)
      .select('hiring_follow_ups.*', 'hiring_candidates.name as candidate_name', 'hiring_candidates.phone as candidate_phone');

    if (req.user.role === 'recruiter') {
      query = query.where('hiring_follow_ups.recruiter_id', req.user.id);
    } else if (req.user.role === 'hiring_team_leader') {
      if (!req.user.hiring_team_id) return res.json([]);
      const teamRecruiterIds = db('users').where({ hiring_team_id: req.user.hiring_team_id, role: 'recruiter' }).select('id');
      query = query.whereIn('hiring_follow_ups.recruiter_id', teamRecruiterIds);
    }

    const followUps = await query.orderBy('follow_up_date', 'asc').limit(20);
    res.json(followUps);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch pending follow-ups' });
  }
});

module.exports = router;
