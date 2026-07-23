// Flat pipeline status model for the Hiring workspace — mirrors the Admissions
// counseling_status pattern (backend/src/index.js's COUNSELING_STATUSES) but with its own
// entirely separate 14-stage flow, independent of anything Admissions-specific.
const HIRING_STATUSES = [
  'New',
  'Contacted',
  'Interested',
  'Not Interested',
  'Call Back',
  'Not Contactable',
  'Registration Pending',
  'Registration Completed',
  'Interview Scheduled',
  'Interview Completed',
  'Selected',
  'Rejected',
  'Offer Released',
  'Joined',
  'Closed'
];

// Sub-reason required when a candidate is marked 'Not Contactable' — mirrors
// Admissions' NOT_CONTACTABLE_REASONS (backend/src/index.js).
const NOT_CONTACTABLE_REASONS = ['Switch Off', 'Out of Coverage', 'Not Picked', 'Call Fail', 'Wrong Number', 'Others'];

// Terminal statuses close out the candidate: the hiring_candidate_assignments row is
// deleted and a hiring_closures row is written instead — exactly mirroring Admissions'
// TERMINAL_STATUSES / closures pattern (backend/src/index.js).
const TERMINAL_HIRING_STATUSES = ['Selected', 'Rejected', 'Joined', 'Closed'];

const REGISTRATION_STATUSES = ['Pending', 'Completed'];
const INTERVIEW_MODES = ['Online', 'Offline'];
const RESULT_STATUSES = ['Selected', 'Rejected', 'Pending'];
const INTERVIEW_STATUSES = ['Scheduled', 'Completed', 'Cancelled', 'No-show'];

module.exports = {
  HIRING_STATUSES,
  TERMINAL_HIRING_STATUSES,
  NOT_CONTACTABLE_REASONS,
  REGISTRATION_STATUSES,
  INTERVIEW_MODES,
  RESULT_STATUSES,
  INTERVIEW_STATUSES
};
