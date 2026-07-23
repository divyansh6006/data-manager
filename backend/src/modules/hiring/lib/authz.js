const db = require('../../../db');

// Shared candidate-access check used by every write endpoint that acts on a specific
// candidate (status update, interview scheduling, follow-ups). super_admin always passes;
// recruiter must own the assignment; hiring_team_leader must have the assignment's
// recruiter within their own hiring_team_id. Without the team_leader branch, a team leader
// could act on ANY team's candidates just by knowing/guessing the id — this scopes writes
// to match the same team boundary already enforced on the list/read endpoints.
async function canAccessCandidate(user, candidateId) {
  if (user.role === 'super_admin') return true;

  // Prefer the active assignment; fall back to the closure record so a recruiter/team
  // leader can still view (read-only) a candidate they closed out, the same way Admissions
  // lets a counselor view their own closed leads via remarks/history.
  const assignment = await db('hiring_candidate_assignments').where({ candidate_id: candidateId }).first();
  const recruiterId = assignment ? assignment.recruiter_id
    : (await db('hiring_closures').where({ candidate_id: candidateId }).first())?.recruiter_id;
  if (!recruiterId) return false;

  if (user.role === 'recruiter') {
    return recruiterId === user.id;
  }
  if (user.role === 'hiring_team_leader') {
    if (!user.hiring_team_id) return false;
    const recruiter = await db('users').where({ id: recruiterId }).first();
    return !!recruiter && recruiter.hiring_team_id === user.hiring_team_id;
  }
  return false;
}

// Same check, but for assigning a candidate to a specific recruiter — verifies the
// TARGET recruiter (not the current assignment) is within the team leader's team.
async function canAssignToRecruiter(user, recruiterId) {
  if (user.role === 'super_admin') return true;
  if (user.role !== 'hiring_team_leader' || !user.hiring_team_id) return false;
  const recruiter = await db('users').where({ id: recruiterId }).first();
  return !!recruiter && recruiter.hiring_team_id === user.hiring_team_id;
}

module.exports = { canAccessCandidate, canAssignToRecruiter };
