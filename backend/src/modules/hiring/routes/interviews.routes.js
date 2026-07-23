const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../../../db');
const { requireRole } = require('../../../auth');
const { logHiringActivity } = require('../lib/activityLog');
const { canAccessCandidate } = require('../lib/authz');

const router = express.Router();

async function assertOwnership(candidateId, user) {
  if (user.role === 'super_admin') return true;
  return canAccessCandidate(user, candidateId);
}

router.post('/candidates/:id/interviews', requireRole(['super_admin', 'hiring_team_leader', 'recruiter']), async (req, res) => {
  const { companyId, round, scheduledDate, scheduledTime, mode, interviewer } = req.body;
  if (!scheduledDate) return res.status(400).json({ error: 'scheduledDate is required.' });
  try {
    if (!(await assertOwnership(req.params.id, req.user))) {
      return res.status(403).json({ error: 'You are not assigned to this candidate.' });
    }
    // assertOwnership (via canAccessCandidate) deliberately also allows read access through a
    // candidate's hiring_closures row for an already-closed candidate. That's fine for viewing
    // history, but this is a WRITE — scheduling an interview against an assignment that no
    // longer exists would silently update 0 rows below while still returning 201 "scheduled",
    // misleadingly implying the pipeline moved. Require an active assignment up front.
    const assignment = await db('hiring_candidate_assignments').where({ candidate_id: req.params.id }).first();
    if (!assignment) {
      return res.status(404).json({ error: 'This candidate is not currently assigned (it may have been closed) — cannot schedule an interview.' });
    }
    const id = randomUUID();
    await db('hiring_interviews').insert({
      id, candidate_id: req.params.id, company_id: companyId || null, round: round || null,
      scheduled_date: scheduledDate, scheduled_time: scheduledTime || null, mode: mode || null,
      interviewer: interviewer || null, status: 'Scheduled', result: 'Pending',
      scheduled_by: req.user.id, created_at: new Date()
    });
    await db('hiring_candidate_assignments').where({ candidate_id: req.params.id }).update({
      interview_scheduled: true, pipeline_status: 'Interview Scheduled', updated_at: new Date()
    });
    await logHiringActivity(db, req.params.id, assignment.recruiter_id, 'interview_scheduled', `Interview scheduled for ${scheduledDate}${scheduledTime ? ' ' + scheduledTime : ''}`);
    res.status(201).json({ id, message: 'Interview scheduled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to schedule interview' });
  }
});

router.put('/interviews/:id', requireRole(['super_admin', 'hiring_team_leader', 'recruiter']), async (req, res) => {
  const { status, result, feedback, scheduledDate, scheduledTime, interviewer, mode } = req.body;
  try {
    const interview = await db('hiring_interviews').where({ id: req.params.id }).first();
    if (!interview) return res.status(404).json({ error: 'Interview not found' });
    if (!(await assertOwnership(interview.candidate_id, req.user))) {
      return res.status(403).json({ error: 'You are not assigned to this candidate.' });
    }
    await db('hiring_interviews').where({ id: req.params.id }).update({
      status: status !== undefined ? status : interview.status,
      result: result !== undefined ? result : interview.result,
      feedback: feedback !== undefined ? feedback : interview.feedback,
      scheduled_date: scheduledDate !== undefined ? scheduledDate : interview.scheduled_date,
      scheduled_time: scheduledTime !== undefined ? scheduledTime : interview.scheduled_time,
      interviewer: interviewer !== undefined ? interviewer : interview.interviewer,
      mode: mode !== undefined ? mode : interview.mode
    });

    if (status === 'Completed') {
      const assignment = await db('hiring_candidate_assignments').where({ candidate_id: interview.candidate_id }).first();
      if (assignment) {
        await db('hiring_candidate_assignments').where({ candidate_id: interview.candidate_id }).update({
          pipeline_status: 'Interview Completed',
          result_status: result || assignment.result_status,
          updated_at: new Date()
        });
        await logHiringActivity(db, interview.candidate_id, assignment.recruiter_id, 'interview_completed', `Interview marked completed — result: ${result || 'Pending'}`);
      }
    }

    res.json({ id: req.params.id, message: 'Interview updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update interview' });
  }
});

// GET /api/hiring/interviews?upcoming=true — today's/upcoming schedule widget
router.get('/interviews', requireRole(['super_admin', 'hiring_team_leader', 'recruiter']), async (req, res) => {
  try {
    let query = db('hiring_interviews')
      .join('hiring_candidates', 'hiring_interviews.candidate_id', 'hiring_candidates.id')
      .leftJoin('hiring_candidate_assignments', 'hiring_interviews.candidate_id', 'hiring_candidate_assignments.candidate_id')
      .leftJoin('companies', 'hiring_interviews.company_id', 'companies.id')
      .select('hiring_interviews.*', 'hiring_candidates.name as candidate_name', 'hiring_candidates.phone as candidate_phone', 'hiring_candidates.email as candidate_email', 'companies.name as company_name');

    if (req.user.role === 'recruiter') {
      query = query.where('hiring_candidate_assignments.recruiter_id', req.user.id);
    } else if (req.user.role === 'hiring_team_leader') {
      if (!req.user.hiring_team_id) return res.json([]);
      const teamRecruiterIds = db('users').where({ hiring_team_id: req.user.hiring_team_id, role: 'recruiter' }).select('id');
      query = query.whereIn('hiring_candidate_assignments.recruiter_id', teamRecruiterIds);
    }

    if (req.query.upcoming === 'true') {
      const today = new Date().toISOString().slice(0, 10);
      query = query.where('hiring_interviews.status', 'Scheduled').where('hiring_interviews.scheduled_date', '>=', today);
    }

    const interviews = await query.orderBy('hiring_interviews.scheduled_date', 'asc');
    res.json(interviews);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch interviews' });
  }
});

// GET /api/hiring/interviews/history?candidateId=
router.get('/interviews/history', requireRole(['super_admin', 'hiring_team_leader', 'recruiter']), async (req, res) => {
  try {
    if (!req.query.candidateId) return res.status(400).json({ error: 'candidateId is required.' });
    if (!(await assertOwnership(req.query.candidateId, req.user))) {
      return res.status(403).json({ error: 'You are not assigned to this candidate.' });
    }
    const interviews = await db('hiring_interviews')
      .leftJoin('companies', 'hiring_interviews.company_id', 'companies.id')
      .where({ candidate_id: req.query.candidateId })
      .select('hiring_interviews.*', 'companies.name as company_name')
      .orderBy('scheduled_date', 'desc');
    res.json(interviews);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch interview history' });
  }
});

module.exports = router;
