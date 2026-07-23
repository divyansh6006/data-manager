const express = require('express');
const db = require('../../../db');
const { requireRole } = require('../../../auth');

const router = express.Router();

// GET /api/hiring/recruiters — list with current load, mirrors /api/users/counselors
router.get('/recruiters', requireRole(['super_admin', 'hiring_team_leader']), async (req, res) => {
  try {
    let query = db('users').where({ role: 'recruiter', active: true });
    if (req.user.role === 'hiring_team_leader') {
      if (!req.user.hiring_team_id) return res.json([]);
      query = query.where({ hiring_team_id: req.user.hiring_team_id });
    }

    const recruiters = await query;
    const recruiterIds = recruiters.map(r => r.id);
    if (recruiterIds.length === 0) return res.json([]);

    const assignments = await db('hiring_candidate_assignments')
      .whereIn('recruiter_id', recruiterIds)
      .groupBy('recruiter_id')
      .select('recruiter_id')
      .count('id as load');

    const loadMap = {};
    assignments.forEach(a => { loadMap[a.recruiter_id] = parseInt(a.load, 10); });

    res.json(recruiters.map(r => ({
      id: r.id, name: r.name, email: r.company_email, hiringTeamId: r.hiring_team_id,
      active: r.active, load: loadMap[r.id] || 0
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch recruiters' });
  }
});

// PUT /api/hiring/recruiters/:id/team — assign a recruiter/team-leader to a hiring team
router.put('/recruiters/:id/team', requireRole(['super_admin']), async (req, res) => {
  const { hiringTeamId } = req.body;
  try {
    const user = await db('users').where({ id: req.params.id }).first();
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!['recruiter', 'hiring_team_leader'].includes(user.role)) {
      return res.status(400).json({ error: 'User is not a Hiring workspace member.' });
    }
    await db('users').where({ id: req.params.id }).update({ hiring_team_id: hiringTeamId || null, updated_at: new Date() });
    res.json({ id: req.params.id, hiringTeamId: hiringTeamId || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update team assignment' });
  }
});

// GET /api/hiring/recruiters/:id/performance
router.get('/recruiters/:id/performance', requireRole(['super_admin', 'hiring_team_leader']), async (req, res) => {
  try {
    const recruiterId = req.params.id;

    // Unlike GET /recruiters (which filters the whole list by hiring_team_id), this by-id
    // lookup had no team check at all — a hiring_team_leader could pull any recruiter's
    // performance stats from any team just by knowing/guessing their user id.
    if (req.user.role === 'hiring_team_leader') {
      if (!req.user.hiring_team_id) return res.status(403).json({ error: 'You are not assigned to a team.' });
      const recruiter = await db('users').where({ id: recruiterId, role: 'recruiter' }).first();
      if (!recruiter || recruiter.hiring_team_id !== req.user.hiring_team_id) {
        return res.status(403).json({ error: 'This recruiter is not on your team.' });
      }
    }

    const active = await db('hiring_candidate_assignments').where({ recruiter_id: recruiterId }).count('id as c').first();
    const closures = await db('hiring_closures')
      .where({ recruiter_id: recruiterId })
      .groupBy('final_status')
      .select('final_status')
      .count('id as count');
    const interviews = await db('hiring_interviews')
      .join('hiring_candidate_assignments', 'hiring_interviews.candidate_id', 'hiring_candidate_assignments.candidate_id')
      .where('hiring_candidate_assignments.recruiter_id', recruiterId)
      .count('hiring_interviews.id as c')
      .first();

    res.json({
      recruiterId,
      activeCandidates: parseInt(active.c, 10),
      closuresBreakdown: closures,
      interviewsHeld: parseInt(interviews.c, 10)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch recruiter performance' });
  }
});

module.exports = router;
