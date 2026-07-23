const { randomUUID } = require('crypto');

// Mirrors the logActivity() helper in backend/src/index.js, scoped to hiring_activity_log.
async function logHiringActivity(dbOrTrx, candidateId, recruiterId, action, remark) {
  await dbOrTrx('hiring_activity_log').insert({
    id: randomUUID(),
    candidate_id: candidateId,
    recruiter_id: recruiterId,
    action,
    remark,
    timestamp: new Date()
  });
}

module.exports = { logHiringActivity };
