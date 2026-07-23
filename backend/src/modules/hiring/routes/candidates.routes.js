const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const { randomUUID } = require('crypto');
const db = require('../../../db');
const { requireRole } = require('../../../auth');
const { HIRING_STATUSES, TERMINAL_HIRING_STATUSES, REGISTRATION_STATUSES, NOT_CONTACTABLE_REASONS } = require('../lib/pipeline');
const { logHiringActivity } = require('../lib/activityLog');
const { cleanPhone, parseExperience, autoMapHeaders } = require('../lib/importHelpers');
const { canAccessCandidate, canAssignToRecruiter } = require('../lib/authz');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (/\.(xlsx|xls|csv)$/i.test(file.originalname)) return cb(null, true);
    return cb(null, false);
  }
});

// Scope a candidate-listing query (already joined to hiring_candidate_assignments) to the
// caller's role — recruiters see only their own, hiring_team_leader sees their team's,
// super_admin sees everything (optionally filtered by ?recruiterId=).
function scopeToRole(query, user, recruiterIdFilter) {
  if (user.role === 'recruiter') {
    return query.where('hiring_candidate_assignments.recruiter_id', user.id);
  }
  if (user.role === 'hiring_team_leader') {
    const teamRecruiterIds = db('users').where({ hiring_team_id: user.hiring_team_id, role: 'recruiter' }).select('id');
    query = query.whereIn('hiring_candidate_assignments.recruiter_id', teamRecruiterIds);
    // A team leader narrowing to one of their own recruiters (the "All Recruiters" dropdown
    // in CandidatesPage.jsx) previously had no effect here — this branch returned before ever
    // looking at recruiterIdFilter, so the list silently ignored the selected recruiter and
    // always showed the whole team. Combining both conditions is safe-by-construction: if
    // recruiterIdFilter isn't actually a member of this team, the whereIn above already
    // excludes it, so this can never leak another team's data even without a separate
    // membership check.
    if (recruiterIdFilter) query = query.where('hiring_candidate_assignments.recruiter_id', recruiterIdFilter);
    return query;
  }
  if (recruiterIdFilter) {
    return query.where('hiring_candidate_assignments.recruiter_id', recruiterIdFilter);
  }
  return query;
}

// GET /api/hiring/candidates — search/filter list
// ?unassigned=true switches to the distribution queue: active candidates with no assignment
// row yet (freshly bulk-uploaded or manually added). Recruiters never see this mode since
// they have nothing to distribute; scopeToRole's join-based team/recruiter scoping doesn't
// apply to unassigned rows anyway (there's no assignment to scope by).
router.get('/candidates', requireRole(['super_admin', 'hiring_team_leader', 'recruiter']), async (req, res) => {
  try {
    const {
      recruiterId, status, location, experienceMin, experienceMax, currentCompany, skills,
      registrationStatus, interviewStatus, createdFrom, createdTo, assignedFrom, assignedTo, search, unassigned
    } = req.query;

    if (unassigned === 'true') {
      if (req.user.role === 'recruiter') return res.json([]);
      let uq = db('hiring_candidates')
        .whereNotExists(
          db('hiring_candidate_assignments').select('id').whereRaw('hiring_candidate_assignments.candidate_id = hiring_candidates.id')
        )
        // Also exclude previously-closed candidates (hiring_closures row exists) — without
        // this, a candidate who was already Selected/Rejected/Joined/Closed (assignment row
        // deleted on closure) reappeared in the unassigned pool indefinitely and could be
        // distributed again while still holding its original closure record.
        .whereNotExists(
          db('hiring_closures').select('id').whereRaw('hiring_closures.candidate_id = hiring_candidates.id')
        )
        .andWhere('hiring_candidates.status', 'active');

      if (location) uq = uq.where('hiring_candidates.current_location', 'like', `%${location}%`);
      if (experienceMin) uq = uq.where('hiring_candidates.experience', '>=', parseFloat(experienceMin));
      if (experienceMax) uq = uq.where('hiring_candidates.experience', '<=', parseFloat(experienceMax));
      if (currentCompany) uq = uq.where('hiring_candidates.current_company', 'like', `%${currentCompany}%`);
      if (skills) uq = uq.where('hiring_candidates.skills', 'like', `%${skills}%`);
      if (createdFrom) uq = uq.where('hiring_candidates.created_at', '>=', new Date(createdFrom));
      if (createdTo) uq = uq.where('hiring_candidates.created_at', '<=', new Date(createdTo));
      if (search) {
        const q = `%${search}%`;
        uq = uq.where(function () {
          this.where('hiring_candidates.name', 'like', q)
            .orWhere('hiring_candidates.phone', 'like', q)
            .orWhere('hiring_candidates.email', 'like', q)
            .orWhere('hiring_candidates.current_location', 'like', q)
            .orWhere('hiring_candidates.current_company', 'like', q)
            .orWhere('hiring_candidates.skills', 'like', q);
        });
      }

      const unassignedCandidates = await uq.select('hiring_candidates.*').orderBy('hiring_candidates.created_at', 'desc');
      return res.json(unassignedCandidates);
    }

    let query = db('hiring_candidates')
      .join('hiring_candidate_assignments', 'hiring_candidates.id', 'hiring_candidate_assignments.candidate_id')
      .leftJoin('users as recruiter', 'hiring_candidate_assignments.recruiter_id', 'recruiter.id')
      .leftJoin('companies', 'hiring_candidate_assignments.company_id', 'companies.id')
      .select(
        'hiring_candidates.*',
        'hiring_candidate_assignments.pipeline_status',
        'hiring_candidate_assignments.registration_status',
        'hiring_candidate_assignments.interview_scheduled',
        'hiring_candidate_assignments.result_status',
        'hiring_candidate_assignments.status_remark',
        'hiring_candidate_assignments.not_contactable_reason',
        'hiring_candidate_assignments.assigned_at',
        'hiring_candidate_assignments.recruiter_id',
        'recruiter.name as recruiter_name',
        'companies.name as company_name',
        // Most recent interview (by date) per candidate, so the list itself shows interview
        // details at a glance instead of requiring the drawer to be opened every time.
        db.raw(`(SELECT scheduled_date FROM hiring_interviews WHERE hiring_interviews.candidate_id = hiring_candidates.id ORDER BY scheduled_date DESC, created_at DESC LIMIT 1) as latest_interview_date`),
        db.raw(`(SELECT scheduled_time FROM hiring_interviews WHERE hiring_interviews.candidate_id = hiring_candidates.id ORDER BY scheduled_date DESC, created_at DESC LIMIT 1) as latest_interview_time`),
        db.raw(`(SELECT status FROM hiring_interviews WHERE hiring_interviews.candidate_id = hiring_candidates.id ORDER BY scheduled_date DESC, created_at DESC LIMIT 1) as latest_interview_status`),
        db.raw(`(SELECT result FROM hiring_interviews WHERE hiring_interviews.candidate_id = hiring_candidates.id ORDER BY scheduled_date DESC, created_at DESC LIMIT 1) as latest_interview_result`)
      );

    query = scopeToRole(query, req.user, recruiterId);

    if (status) query = query.where('hiring_candidate_assignments.pipeline_status', status);
    if (location) query = query.where('hiring_candidates.current_location', 'like', `%${location}%`);
    if (experienceMin) query = query.where('hiring_candidates.experience', '>=', parseFloat(experienceMin));
    if (experienceMax) query = query.where('hiring_candidates.experience', '<=', parseFloat(experienceMax));
    if (currentCompany) query = query.where('hiring_candidates.current_company', 'like', `%${currentCompany}%`);
    if (skills) query = query.where('hiring_candidates.skills', 'like', `%${skills}%`);
    if (registrationStatus) query = query.where('hiring_candidate_assignments.registration_status', registrationStatus);
    if (interviewStatus === 'true' || interviewStatus === 'false') {
      query = query.where('hiring_candidate_assignments.interview_scheduled', interviewStatus === 'true');
    }
    if (createdFrom) query = query.where('hiring_candidates.created_at', '>=', new Date(createdFrom));
    if (createdTo) query = query.where('hiring_candidates.created_at', '<=', new Date(createdTo));
    if (assignedFrom) query = query.where('hiring_candidate_assignments.assigned_at', '>=', new Date(assignedFrom));
    if (assignedTo) query = query.where('hiring_candidate_assignments.assigned_at', '<=', new Date(assignedTo));
    if (search) {
      const q = `%${search}%`;
      query = query.where(function () {
        this.where('hiring_candidates.name', 'like', q)
          .orWhere('hiring_candidates.phone', 'like', q)
          .orWhere('hiring_candidates.email', 'like', q)
          .orWhere('hiring_candidates.current_location', 'like', q)
          .orWhere('hiring_candidates.current_company', 'like', q)
          .orWhere('hiring_candidates.skills', 'like', q);
      });
    }

    const candidates = await query.orderBy('hiring_candidates.created_at', 'desc');
    res.json(candidates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
});

// Shared query builder for the Master Repository — unlike GET /candidates (which inner-joins
// hiring_candidate_assignments and so excludes raw duplicate/invalid candidates and anyone
// already closed, since closing deletes their assignment row), this LEFT JOINs both
// hiring_candidate_assignments and hiring_closures so EVERY candidate ever entered shows up,
// with a unified overall_status column. Mirrors GET /api/leads/master (backend/src/index.js).
// candidate_id is .unique() on both assignments and closures, and a candidate can only ever
// have one or the other (never both — closing deletes the assignment row), so this double
// left-join never fans out into duplicate rows per candidate.
function buildMasterQuery(user, { status, source, recruiterId, search } = {}) {
  let query = db('hiring_candidates')
    .leftJoin('hiring_candidate_assignments', 'hiring_candidates.id', 'hiring_candidate_assignments.candidate_id')
    .leftJoin('users as recruiter', 'hiring_candidate_assignments.recruiter_id', 'recruiter.id')
    .leftJoin('hiring_closures', 'hiring_candidates.id', 'hiring_closures.candidate_id')
    .leftJoin('users as closure_recruiter', 'hiring_closures.recruiter_id', 'closure_recruiter.id');

  if (user.role === 'hiring_team_leader') {
    const teamRecruiterIds = db('users').where({ hiring_team_id: user.hiring_team_id, role: 'recruiter' }).select('id');
    // Scope by team membership checked against EITHER attribution source — filtering only
    // the left-joined assignment column would silently turn this into an inner join and drop
    // every closed candidate (whose assignment row no longer exists). Mirrors the identical
    // reasoning in GET /api/leads/master (backend/src/index.js:2708-2718).
    query = query.where(function () {
      this.whereIn('hiring_candidate_assignments.recruiter_id', teamRecruiterIds)
        .orWhereIn('hiring_closures.recruiter_id', teamRecruiterIds);
    });
  }
  if (recruiterId) {
    query = query.where(function () {
      this.where('hiring_candidate_assignments.recruiter_id', recruiterId)
        .orWhere('hiring_closures.recruiter_id', recruiterId);
    });
  }

  query = query.select(
    'hiring_candidates.*',
    'hiring_candidate_assignments.pipeline_status',
    'hiring_candidate_assignments.registration_status',
    'hiring_candidate_assignments.interview_scheduled',
    'hiring_candidate_assignments.result_status',
    'hiring_candidate_assignments.status_remark',
    'hiring_candidate_assignments.assigned_at',
    'hiring_closures.final_status',
    'hiring_closures.drop_stage',
    'hiring_closures.drop_remark',
    'hiring_closures.closed_at',
    db.raw('COALESCE(recruiter.name, closure_recruiter.name) as recruiter_name'),
    // Named overall_status, NOT status — hiring_candidates.* above already includes the raw
    // upload status ('active'/'duplicate'/'invalid'); reusing that name would silently
    // collide/overwrite depending on select-column ordering.
    db.raw('COALESCE(hiring_candidate_assignments.pipeline_status, hiring_closures.final_status, hiring_candidates.status) as overall_status')
  );

  if (status) {
    query = query.where(function () {
      this.where('hiring_candidate_assignments.pipeline_status', status)
        .orWhere('hiring_closures.final_status', status)
        .orWhere('hiring_candidates.status', status);
    });
  }
  if (source) query = query.where('hiring_candidates.source', source);
  if (search) {
    const q = `%${search}%`;
    query = query.where(function () {
      this.where('hiring_candidates.name', 'like', q)
        .orWhere('hiring_candidates.phone', 'like', q)
        .orWhere('hiring_candidates.email', 'like', q)
        .orWhere('hiring_candidates.current_location', 'like', q)
        .orWhere('hiring_candidates.current_company', 'like', q);
    });
  }

  return query.orderBy('hiring_candidates.created_at', 'desc');
}

// CSV/Excel formula-injection guard, copied from sanitizeForExport() in backend/src/index.js —
// Hiring's export is new and doesn't have this yet. Applied to every row/column just before
// json_to_sheet so a candidate's name/company/source/etc. can never be interpreted as a live
// formula by Excel/Sheets when the exported file is opened.
function sanitizeForExport(rows) {
  return rows.map(row => {
    const safeRow = {};
    for (const key of Object.keys(row)) {
      const value = row[key];
      if (typeof value === 'string' && /^[=+\-@\t\r]/.test(value)) {
        safeRow[key] = `'${value}`;
      } else {
        safeRow[key] = value;
      }
    }
    return safeRow;
  });
}

function toExportRows(candidates) {
  return candidates.map(c => {
    let skillsDisplay = '';
    if (c.skills) {
      try {
        const parsed = typeof c.skills === 'string' ? JSON.parse(c.skills) : c.skills;
        skillsDisplay = Array.isArray(parsed) ? parsed.join(', ') : String(parsed);
      } catch {
        skillsDisplay = String(c.skills);
      }
    }
    return {
      'Candidate Name': c.name,
      'Phone': c.phone,
      'Email': c.email,
      'Location': c.current_location,
      'Experience (Yrs)': c.experience,
      'Current Company': c.current_company,
      'Skills': skillsDisplay,
      'Source': c.source,
      'Recruiter': c.recruiter_name,
      'Status': c.overall_status,
      'Registration Status': c.registration_status,
      'Upload Date': c.created_at
    };
  });
}

// GET /api/hiring/candidates/master — full data repository: every candidate ever entered
// (active pipeline, closed/terminal, and raw duplicate/invalid never assigned), each with a
// unified overall_status. Registered ahead of GET /candidates/:id so 'master' isn't swallowed
// by the :id param route.
router.get('/candidates/master', requireRole(['super_admin', 'hiring_team_leader']), async (req, res) => {
  if (req.user.role === 'hiring_team_leader' && !req.user.hiring_team_id) return res.json([]);
  try {
    const { status, source, recruiterId, search } = req.query;
    const rows = await buildMasterQuery(req.user, { status, source, recruiterId, search });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch master candidate repository' });
  }
});

// GET /api/hiring/candidates/export — xlsx download of the master repository, respecting the
// same filters as /candidates/master. Mirrors GET /api/leads/export/batch/:batchId's
// xlsx.utils.book_new/json_to_sheet/write pattern (backend/src/index.js:1289-1296).
router.get('/candidates/export', requireRole(['super_admin', 'hiring_team_leader']), async (req, res) => {
  if (req.user.role === 'hiring_team_leader' && !req.user.hiring_team_id) return res.status(404).json({ error: 'No candidates to export' });
  try {
    const { status, source, recruiterId, search } = req.query;
    const rows = await buildMasterQuery(req.user, { status, source, recruiterId, search });

    await logHiringActivity(db, null, req.user.id, 'download', `Downloaded master candidate repository export (${rows.length} candidates)`);

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(sanitizeForExport(toExportRows(rows)));
    xlsx.utils.book_append_sheet(wb, ws, 'Candidates');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="hiring-master-repository.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export candidate repository' });
  }
});

// GET /api/hiring/candidates/export/batch/:batchId — xlsx export of one upload batch.
// super_admin only, matching /upload-batches and /candidates/upload's existing gating.
router.get('/candidates/export/batch/:batchId', requireRole(['super_admin']), async (req, res) => {
  const { batchId } = req.params;
  try {
    const batch = await db('hiring_upload_batches').where({ id: batchId }).first();
    if (!batch) return res.status(404).json({ error: 'Upload batch not found' });

    const rows = await buildMasterQuery(req.user, {}).where('hiring_candidates.upload_batch_id', batchId);

    await logHiringActivity(db, null, req.user.id, 'download', `Downloaded batch export: ${batch.file_name} (${rows.length} candidates)`);

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(sanitizeForExport(toExportRows(rows)));
    xlsx.utils.book_append_sheet(wb, ws, 'Candidates');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', `attachment; filename="${batch.file_name.replace(/\.[^.]+$/, '')}-export.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export batch' });
  }
});

// GET /api/hiring/candidates/:id — full detail
router.get('/candidates/:id', requireRole(['super_admin', 'hiring_team_leader', 'recruiter']), async (req, res) => {
  try {
    const candidate = await db('hiring_candidates').where({ id: req.params.id }).first();
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    const assignment = await db('hiring_candidate_assignments')
      .leftJoin('users as recruiter', 'hiring_candidate_assignments.recruiter_id', 'recruiter.id')
      .leftJoin('users as assigner', 'hiring_candidate_assignments.assigned_by', 'assigner.id')
      .leftJoin('companies', 'hiring_candidate_assignments.company_id', 'companies.id')
      .where({ candidate_id: req.params.id })
      .select('hiring_candidate_assignments.*', 'recruiter.name as recruiter_name', 'assigner.name as assigned_by_name', 'companies.name as company_name')
      .first();

    if (req.user.role !== 'super_admin' && !(await canAccessCandidate(req.user, req.params.id))) {
      return res.status(403).json({ error: 'You do not have access to this candidate.' });
    }

    const interviews = await db('hiring_interviews')
      .leftJoin('companies', 'hiring_interviews.company_id', 'companies.id')
      .where({ candidate_id: req.params.id })
      .select('hiring_interviews.*', 'companies.name as company_name')
      .orderBy('scheduled_date', 'desc');

    const closure = await db('hiring_closures').where({ candidate_id: req.params.id }).first();

    res.json({ ...candidate, assignment: assignment || null, interviews, closure: closure || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch candidate' });
  }
});

// POST /api/hiring/candidates — manual add (recruiters never create their own, per spec)
router.post('/candidates', requireRole(['super_admin', 'hiring_team_leader']), async (req, res) => {
  const { name, phone, email, currentLocation, experience, currentCompany, expectedSalary, noticePeriod, skills, resumeUrl, source } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required.' });
  }
  try {
    const id = randomUUID();
    await db('hiring_candidates').insert({
      id,
      name: name.trim(),
      phone: cleanPhone(phone),
      email: email ? email.trim().toLowerCase() : null,
      current_location: currentLocation || null,
      experience: experience !== undefined && experience !== '' ? parseFloat(experience) : null,
      current_company: currentCompany || null,
      expected_salary: expectedSalary !== undefined && expectedSalary !== '' ? parseFloat(expectedSalary) : null,
      notice_period: noticePeriod || null,
      skills: skills ? JSON.stringify(Array.isArray(skills) ? skills : String(skills).split(',').map(s => s.trim()).filter(Boolean)) : null,
      resume_url: resumeUrl || null,
      source: source || 'Manual Entry',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    });
    await logHiringActivity(db, id, null, 'note', `Candidate created by ${req.user.name}`);
    res.status(201).json({ id, name, phone });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create candidate' });
  }
});

// POST /api/hiring/candidates/upload-preview — parse the sheet, auto-map headers, return a
// 5-row preview so the uploader can verify/correct the mapping before committing anything.
// Mirrors /api/leads/upload-preview exactly, just with the hiring candidate field set.
router.post('/candidates/upload-preview', requireRole(['super_admin']), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);
    if (rows.length === 0) return res.status(400).json({ error: 'Uploaded sheet is empty' });

    const headers = Object.keys(rows[0]);
    const autoMapping = autoMapHeaders(headers);
    const previewRows = rows.slice(0, 5);

    const systemFields = [
      { key: 'name', label: 'Candidate Name', required: true },
      { key: 'phone', label: 'Phone Number', required: true },
      { key: 'email', label: 'Email ID', required: false },
      { key: 'current_location', label: 'Current Location', required: false },
      { key: 'experience', label: 'Experience (Yrs)', required: false },
      { key: 'current_company', label: 'Current Company', required: false },
      { key: 'expected_salary', label: 'Expected Salary', required: false },
      { key: 'notice_period', label: 'Notice Period', required: false },
      { key: 'skills', label: 'Skills (comma-separated)', required: false },
      { key: 'source', label: 'Source', required: false }
    ];

    res.json({ headers, previewRows, autoMapping, systemFields });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to parse Excel file preview.' });
  }
});

// POST /api/hiring/candidates/upload — bulk Excel/CSV import, mirrors /api/leads/upload
router.post('/candidates/upload', requireRole(['super_admin']), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);
    if (rows.length === 0) return res.status(400).json({ error: 'Uploaded sheet is empty' });

    const batchId = randomUUID();
    const cleanCandidates = [];
    const duplicateCandidates = [];
    const invalidCandidates = [];

    const existing = await db('hiring_candidates').select('phone');
    const existingPhones = new Set(existing.map(c => c.phone));
    const seenPhones = new Set();

    const headers = Object.keys(rows[0]);
    const autoMapping = autoMapHeaders(headers);
    let mapping = autoMapping;
    if (req.body.mapping) {
      try {
        const userMap = typeof req.body.mapping === 'string' ? JSON.parse(req.body.mapping) : req.body.mapping;
        mapping = {};
        for (const field of Object.keys(autoMapping)) mapping[field] = userMap[field] || null;
      } catch (e) {
        console.error('Failed to parse mapping body:', e);
        mapping = autoMapping;
      }
    }
    const getVal = (row, field) => {
      const header = mapping[field];
      if (!header) return null;
      const v = row[header];
      return v !== undefined && v !== null ? v : null;
    };

    rows.forEach(row => {
      const hasAnyValue = Object.values(row).some(v => v !== undefined && v !== null && String(v).trim() !== '');
      if (!hasAnyValue) return;

      const name = getVal(row, 'name') ? String(getVal(row, 'name')).trim() : '';
      const phone = cleanPhone(getVal(row, 'phone'));
      const email = getVal(row, 'email') ? String(getVal(row, 'email')).trim().toLowerCase() : null;
      const currentLocation = getVal(row, 'current_location') ? String(getVal(row, 'current_location')).trim() : null;
      const expRaw = getVal(row, 'experience');
      const experience = expRaw !== null ? parseExperience(expRaw) : null;
      const currentCompany = getVal(row, 'current_company') ? String(getVal(row, 'current_company')).trim() : null;
      const salRaw = getVal(row, 'expected_salary');
      const expectedSalary = salRaw !== null && !isNaN(parseFloat(salRaw)) ? parseFloat(salRaw) : null;
      const noticePeriod = getVal(row, 'notice_period') ? String(getVal(row, 'notice_period')).trim() : null;
      const skillsRaw = getVal(row, 'skills');
      const skills = skillsRaw ? String(skillsRaw).split(',').map(s => s.trim()).filter(Boolean) : null;
      const source = getVal(row, 'source') ? String(getVal(row, 'source')).trim() : 'Excel Upload';

      const entry = {
        id: randomUUID(), name: name || 'Unknown', phone, email, current_location: currentLocation,
        experience: (experience === null || isNaN(experience)) ? null : experience, current_company: currentCompany,
        expected_salary: expectedSalary, notice_period: noticePeriod,
        skills: skills ? JSON.stringify(skills) : null, source, upload_batch_id: batchId,
        status: 'active', created_at: new Date(), updated_at: new Date()
      };

      if (!name || !phone || (experience !== null && isNaN(experience))) {
        entry.status = 'invalid';
        invalidCandidates.push(entry);
        return;
      }
      if (existingPhones.has(phone) || seenPhones.has(phone)) {
        entry.status = 'duplicate';
        duplicateCandidates.push(entry);
        return;
      }
      seenPhones.add(phone);
      cleanCandidates.push(entry);
    });

    await db.transaction(async (trx) => {
      await trx('hiring_upload_batches').insert({
        id: batchId,
        uploaded_by: req.user.id,
        file_name: req.file.originalname,
        upload_date: new Date(),
        total_rows: cleanCandidates.length + duplicateCandidates.length + invalidCandidates.length,
        clean_rows: cleanCandidates.length,
        duplicate_rows: duplicateCandidates.length,
        invalid_rows: invalidCandidates.length
      });
      const allRows = [...cleanCandidates, ...duplicateCandidates, ...invalidCandidates];
      if (allRows.length > 0) await trx('hiring_candidates').insert(allRows);
    });

    res.json({
      batchId,
      totalRows: cleanCandidates.length + duplicateCandidates.length + invalidCandidates.length,
      cleanRows: cleanCandidates.length,
      duplicateRows: duplicateCandidates.length,
      invalidRows: invalidCandidates.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process upload' });
  }
});

// GET /api/hiring/upload-batches
router.get('/upload-batches', requireRole(['super_admin']), async (req, res) => {
  try {
    const batches = await db('hiring_upload_batches')
      .leftJoin('users', 'hiring_upload_batches.uploaded_by', 'users.id')
      .select('hiring_upload_batches.*', 'users.name as uploaded_by_name')
      .orderBy('upload_date', 'desc');
    res.json(batches);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch upload batches' });
  }
});

// PUT /api/hiring/candidates/:id — edit profile fields
router.put('/candidates/:id', requireRole(['super_admin', 'hiring_team_leader']), async (req, res) => {
  const { name, phone, email, currentLocation, experience, currentCompany, expectedSalary, noticePeriod, skills, resumeUrl } = req.body;
  try {
    const candidate = await db('hiring_candidates').where({ id: req.params.id }).first();
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    await db('hiring_candidates').where({ id: req.params.id }).update({
      name: name !== undefined ? name.trim() : candidate.name,
      phone: phone !== undefined ? cleanPhone(phone) : candidate.phone,
      email: email !== undefined ? (email ? email.trim().toLowerCase() : null) : candidate.email,
      current_location: currentLocation !== undefined ? currentLocation : candidate.current_location,
      experience: experience !== undefined ? (experience === '' ? null : parseFloat(experience)) : candidate.experience,
      current_company: currentCompany !== undefined ? currentCompany : candidate.current_company,
      expected_salary: expectedSalary !== undefined ? (expectedSalary === '' ? null : parseFloat(expectedSalary)) : candidate.expected_salary,
      notice_period: noticePeriod !== undefined ? noticePeriod : candidate.notice_period,
      skills: skills !== undefined ? JSON.stringify(Array.isArray(skills) ? skills : String(skills).split(',').map(s => s.trim()).filter(Boolean)) : candidate.skills,
      resume_url: resumeUrl !== undefined ? resumeUrl : candidate.resume_url,
      updated_at: new Date()
    });
    res.json({ id: req.params.id, message: 'Candidate updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update candidate' });
  }
});

// POST /api/hiring/candidates/:id/assign — assign (or reassign) to a recruiter
router.post('/candidates/:id/assign', requireRole(['super_admin', 'hiring_team_leader']), async (req, res) => {
  const { recruiterId, companyId } = req.body;
  if (!recruiterId) return res.status(400).json({ error: 'recruiterId is required.' });
  try {
    const candidate = await db('hiring_candidates').where({ id: req.params.id }).first();
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    if (req.user.role !== 'super_admin' && !(await canAssignToRecruiter(req.user, recruiterId))) {
      return res.status(403).json({ error: 'You can only assign candidates to recruiters on your own team.' });
    }

    // A closed candidate (hiring_closures row present) must never receive a new assignment —
    // candidate_id is .unique() on hiring_closures, so a later status-change back to terminal
    // would throw a unique-constraint error and leave the candidate stuck; catch it here with
    // a clear message instead.
    const existingClosure = await db('hiring_closures').where({ candidate_id: req.params.id }).first();
    if (existingClosure) {
      return res.status(400).json({ error: `This candidate is already closed (final status: ${existingClosure.final_status}) and cannot be reassigned.` });
    }

    const existing = await db('hiring_candidate_assignments').where({ candidate_id: req.params.id }).first();
    // If this candidate already belongs to someone, a team leader may only move it if it's
    // currently within their own team too — otherwise a team leader could "poach" a
    // candidate actively owned by a different team just by knowing its id.
    if (existing && req.user.role === 'hiring_team_leader' && !(await canAccessCandidate(req.user, req.params.id))) {
      return res.status(403).json({ error: 'This candidate belongs to another team.' });
    }
    if (existing) {
      await db('hiring_candidate_assignments').where({ candidate_id: req.params.id }).update({
        recruiter_id: recruiterId, assigned_by: req.user.id, company_id: companyId || existing.company_id,
        assigned_at: new Date(), updated_at: new Date()
      });
    } else {
      await db('hiring_candidate_assignments').insert({
        id: randomUUID(), candidate_id: req.params.id, recruiter_id: recruiterId, assigned_by: req.user.id,
        company_id: companyId || null, assigned_at: new Date(), pipeline_status: 'New',
        registration_status: 'Pending', interview_scheduled: false, result_status: 'Pending', updated_at: new Date()
      });
    }
    await logHiringActivity(db, req.params.id, recruiterId, 'assign', `Assigned by ${req.user.name}`);
    res.json({ id: req.params.id, message: 'Candidate assigned' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to assign candidate' });
  }
});

// POST /api/hiring/candidates/distribute — count-based bulk distribution, mirrors
// /api/leads/distribute exactly: the caller picks a filtered pool + types a candidate COUNT
// per recruiter (not individual candidates), and this atomically hands out that many
// oldest-first candidates from the pool, split proportionally between fresher (no/zero
// experience) and experienced candidates so every recruiter gets a comparable mix.
router.post('/candidates/distribute', requireRole(['super_admin']), async (req, res) => {
  const { allocations, filterCriteria, sourceBatchId } = req.body;
  if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
    return res.status(400).json({ error: 'Allocations list is required' });
  }

  const totalRequested = allocations.reduce((sum, item) => sum + parseInt(item.count || 0, 10), 0);
  if (totalRequested <= 0) {
    return res.status(400).json({ error: 'Total requested allocation count must be greater than zero' });
  }

  // Recruiter validity + team-scoping must be checked BEFORE the transaction opens —
  // canAssignToRecruiter uses the plain db connection, which would deadlock the pool if
  // called from inside an open db.transaction() (see PUT /candidates/:id/status for the
  // same lesson learned earlier).
  for (const alloc of allocations) {
    if (parseInt(alloc.count, 10) <= 0) continue;
    if (req.user.role !== 'super_admin' && !(await canAssignToRecruiter(req.user, alloc.recruiterId))) {
      return res.status(403).json({ error: 'You can only distribute candidates to recruiters on your own team.' });
    }
  }

  try {
    await db.transaction(async (trx) => {
      const { location, experienceMin, experienceMax, currentCompany, search, createdFrom, createdTo } = filterCriteria || {};

      let query = trx('hiring_candidates')
        .whereNotExists(
          trx('hiring_candidate_assignments').select('id').whereRaw('hiring_candidate_assignments.candidate_id = hiring_candidates.id')
        )
        // Exclude previously-closed candidates too — see the identical fix/comment on the
        // GET /candidates?unassigned=true pool query above.
        .whereNotExists(
          trx('hiring_closures').select('id').whereRaw('hiring_closures.candidate_id = hiring_candidates.id')
        )
        .andWhere('hiring_candidates.status', 'active')
        .select('hiring_candidates.id', 'hiring_candidates.experience')
        .forUpdate();

      if (sourceBatchId) query = query.where({ 'hiring_candidates.upload_batch_id': sourceBatchId });
      if (location) query = query.where('hiring_candidates.current_location', 'like', `%${location}%`);
      if (experienceMin) query = query.where('hiring_candidates.experience', '>=', parseFloat(experienceMin));
      if (experienceMax) query = query.where('hiring_candidates.experience', '<=', parseFloat(experienceMax));
      if (currentCompany) query = query.where('hiring_candidates.current_company', 'like', `%${currentCompany}%`);
      if (createdFrom) query = query.where('hiring_candidates.created_at', '>=', new Date(createdFrom));
      if (createdTo) query = query.where('hiring_candidates.created_at', '<=', new Date(createdTo));
      if (search) {
        const q = `%${search}%`;
        query = query.where(function () {
          this.where('hiring_candidates.name', 'like', q)
            .orWhere('hiring_candidates.phone', 'like', q)
            .orWhere('hiring_candidates.email', 'like', q)
            .orWhere('hiring_candidates.current_location', 'like', q)
            .orWhere('hiring_candidates.current_company', 'like', q)
            .orWhere('hiring_candidates.skills', 'like', q);
        });
      }

      const availableCandidates = await query.orderBy('hiring_candidates.created_at', 'asc');

      if (availableCandidates.length < totalRequested) {
        throw new Error(`Insufficient candidates in the pool. Requested: ${totalRequested}, Available: ${availableCandidates.length}`);
      }

      // Same fresher/experienced proportional-split logic as /api/leads/distribute, so no
      // recruiter's share is skewed all-fresher or all-experienced by draining one category.
      const fresherPool = availableCandidates.filter(c => !c.experience || c.experience <= 0);
      const experiencedPool = availableCandidates.filter(c => c.experience > 0);
      let fPtr = 0, ePtr = 0;
      let fRemaining = fresherPool.length;
      let eRemaining = experiencedPool.length;

      for (const alloc of allocations) {
        const count = parseInt(alloc.count, 10);
        if (count <= 0) continue;

        const recruiter = await trx('users').where({ id: alloc.recruiterId, role: 'recruiter', active: true }).first();
        if (!recruiter) throw new Error(`Recruiter ${alloc.recruiterId} is not active or invalid.`);

        const totalRemaining = fRemaining + eRemaining;
        let fShare = totalRemaining > 0 ? Math.round(count * fRemaining / totalRemaining) : 0;
        fShare = Math.min(fShare, fRemaining, count);
        let eShare = count - fShare;
        if (eShare > eRemaining) {
          const shortfall = eShare - eRemaining;
          eShare = eRemaining;
          fShare += shortfall;
        }

        const batchCandidates = [
          ...fresherPool.slice(fPtr, fPtr + fShare),
          ...experiencedPool.slice(ePtr, ePtr + eShare)
        ];
        fPtr += fShare;
        fRemaining -= fShare;
        ePtr += eShare;
        eRemaining -= eShare;

        for (const candidate of batchCandidates) {
          await trx('hiring_candidate_assignments').insert({
            id: randomUUID(), candidate_id: candidate.id, recruiter_id: alloc.recruiterId, assigned_by: req.user.id,
            company_id: alloc.companyId || null, assigned_at: new Date(), pipeline_status: 'New',
            registration_status: 'Pending', interview_scheduled: false, result_status: 'Pending', updated_at: new Date()
          });
          await logHiringActivity(trx, candidate.id, alloc.recruiterId, 'assign', `Distributed by ${req.user.name}`);
        }
      }
    });

    res.json({ distributed: totalRequested, message: `${totalRequested} candidate(s) distributed successfully.` });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to distribute candidates' });
  }
});

// POST /api/hiring/candidates/:id/transfer-request — recruiter requests a transfer
router.post('/candidates/:id/transfer-request', requireRole(['recruiter']), async (req, res) => {
  const { reason, note } = req.body;
  if (!reason) return res.status(400).json({ error: 'reason is required.' });
  try {
    const assignment = await db('hiring_candidate_assignments').where({ candidate_id: req.params.id, recruiter_id: req.user.id }).first();
    if (!assignment) return res.status(403).json({ error: 'You are not assigned to this candidate.' });

    const existingPending = await db('hiring_transfer_requests').where({ candidate_id: req.params.id, status: 'pending' }).first();
    if (existingPending) {
      return res.status(400).json({ error: 'A transfer request for this candidate is already pending review.' });
    }

    const id = randomUUID();
    await db('hiring_transfer_requests').insert({
      id, candidate_id: req.params.id, requested_by: req.user.id, request_type: 'give_up',
      reason, note: note || null, status: 'pending', created_at: new Date()
    });
    res.status(201).json({ id, message: 'Transfer request submitted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit transfer request' });
  }
});

// GET /api/hiring/transfer-requests — pending queue for a team leader/admin to review.
// Scoped by the REQUESTING recruiter's team (the recruiter giving up the candidate), same
// boundary as approve/reject below — a team leader only ever sees their own team's requests.
router.get('/transfer-requests', requireRole(['super_admin', 'hiring_team_leader']), async (req, res) => {
  try {
    let query = db('hiring_transfer_requests')
      .join('hiring_candidates', 'hiring_transfer_requests.candidate_id', 'hiring_candidates.id')
      .join('users as requesters', 'hiring_transfer_requests.requested_by', 'requesters.id')
      .where('hiring_transfer_requests.status', 'pending')
      .select(
        'hiring_transfer_requests.*',
        'hiring_candidates.name as candidate_name',
        'hiring_candidates.phone as candidate_phone',
        'hiring_candidates.email as candidate_email',
        'requesters.name as requested_by_name'
      );
    if (req.user.role === 'hiring_team_leader') {
      if (!req.user.hiring_team_id) return res.json([]);
      query = query.where('requesters.hiring_team_id', req.user.hiring_team_id);
    }
    const requests = await query.orderBy('hiring_transfer_requests.created_at', 'asc');
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch transfer requests' });
  }
});

// PUT /api/hiring/transfer-requests/:id/approve|reject
router.put('/transfer-requests/:id/approve', requireRole(['super_admin', 'hiring_team_leader']), async (req, res) => {
  const { targetRecruiterId } = req.body;
  if (!targetRecruiterId) return res.status(400).json({ error: 'targetRecruiterId is required.' });
  if (req.user.role !== 'super_admin' && !(await canAssignToRecruiter(req.user, targetRecruiterId))) {
    return res.status(403).json({ error: 'You can only transfer candidates to recruiters on your own team.' });
  }
  try {
    const request = await db('hiring_transfer_requests').where({ id: req.params.id }).first();
    if (!request) return res.status(404).json({ error: 'Transfer request not found' });
    if (request.status !== 'pending') {
      return res.status(409).json({ error: `This transfer request has already been ${request.status}.` });
    }
    if (req.user.role === 'hiring_team_leader' && !(await canAccessCandidate(req.user, request.candidate_id))) {
      return res.status(403).json({ error: 'This candidate belongs to another team.' });
    }

    await db.transaction(async (trx) => {
      // The candidate may have been closed out in the meantime (no assignment row left) —
      // without this check the UPDATE below silently affects 0 rows, yet the request still
      // gets marked 'approved' as if a real transfer had happened.
      const assignment = await trx('hiring_candidate_assignments').where({ candidate_id: request.candidate_id }).first();
      if (!assignment) {
        throw new Error('This candidate is no longer actively assigned (it may have been closed) — the transfer cannot be completed.');
      }
      await trx('hiring_candidate_assignments').where({ candidate_id: request.candidate_id }).update({
        recruiter_id: targetRecruiterId, assigned_by: req.user.id, assigned_at: new Date(), updated_at: new Date()
      });
      await trx('hiring_transfer_requests').where({ id: req.params.id }).update({
        status: 'approved', reviewed_by: req.user.id, reviewed_at: new Date(), target_recruiter_id: targetRecruiterId
      });
      await logHiringActivity(trx, request.candidate_id, targetRecruiterId, 'transfer', `Transfer approved by ${req.user.name}`);
    });
    res.json({ message: 'Transfer approved' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to approve transfer' });
  }
});

router.put('/transfer-requests/:id/reject', requireRole(['super_admin', 'hiring_team_leader']), async (req, res) => {
  try {
    const request = await db('hiring_transfer_requests').where({ id: req.params.id }).first();
    if (!request) return res.status(404).json({ error: 'Transfer request not found' });
    if (request.status !== 'pending') {
      return res.status(409).json({ error: `This transfer request has already been ${request.status}.` });
    }
    // Same team-ownership boundary as approve — without this, a team leader could reject
    // (and thus permanently close out) another team's pending transfer request just by
    // knowing/guessing its id.
    if (req.user.role === 'hiring_team_leader' && !(await canAccessCandidate(req.user, request.candidate_id))) {
      return res.status(403).json({ error: 'This candidate belongs to another team.' });
    }
    await db('hiring_transfer_requests').where({ id: req.params.id }).update({
      status: 'rejected', reviewed_by: req.user.id, reviewed_at: new Date()
    });
    res.json({ message: 'Transfer rejected' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reject transfer' });
  }
});

// PUT /api/hiring/candidates/:id/status — pipeline update, handles terminal->hiring_closures.
// hiring_team_leader is deliberately excluded — pipeline status is the recruiter's own
// day-to-day working action, not a supervision power; team leaders get team overview,
// reporting, and transfer approvals instead (see the Hiring Team Leader dashboard).
router.put('/candidates/:id/status', requireRole(['super_admin', 'recruiter']), async (req, res) => {
  const { status, remark, registrationStatus, resultStatus, notContactableReason, followUpDate } = req.body;
  if (!status || !HIRING_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${HIRING_STATUSES.join(', ')}` });
  }
  if (!remark || !remark.trim()) {
    return res.status(400).json({ error: 'A remark is required to update the status.' });
  }
  if (registrationStatus && !REGISTRATION_STATUSES.includes(registrationStatus)) {
    return res.status(400).json({ error: `registrationStatus must be one of: ${REGISTRATION_STATUSES.join(', ')}` });
  }
  if (status === 'Not Contactable' && !NOT_CONTACTABLE_REASONS.includes(notContactableReason)) {
    return res.status(400).json({ error: `notContactableReason must be one of: ${NOT_CONTACTABLE_REASONS.join(', ')}` });
  }
  if (status === 'Call Back' && (!followUpDate || isNaN(new Date(followUpDate).getTime()))) {
    return res.status(400).json({ error: 'A valid follow-up date/time is required when setting status to Call Back.' });
  }

  try {
    // Authorization check happens BEFORE opening the transaction — canAccessCandidate
    // uses the plain `db` connection internally (not trx), and calling a non-transacting
    // query from inside an open db.transaction() on SQLite deadlocks the connection pool
    // (the transaction holds the only connection while the nested query waits for one).
    const preCheckAssignment = await db('hiring_candidate_assignments').where({ candidate_id: req.params.id }).first();
    if (!preCheckAssignment) {
      return res.status(400).json({ error: 'This candidate is not currently assigned.' });
    }
    if (req.user.role !== 'super_admin' && !(await canAccessCandidate(req.user, req.params.id))) {
      return res.status(403).json({ error: 'Access denied: You do not have access to this candidate.' });
    }

    await db.transaction(async (trx) => {
      const assignment = await trx('hiring_candidate_assignments').where({ candidate_id: req.params.id }).first();
      if (!assignment) throw new Error('This candidate is not currently assigned.');

      const isTerminal = TERMINAL_HIRING_STATUSES.includes(status);

      if (!isTerminal) {
        await trx('hiring_candidate_assignments').where({ candidate_id: req.params.id }).update({
          pipeline_status: status,
          registration_status: registrationStatus || assignment.registration_status,
          result_status: resultStatus || assignment.result_status,
          status_remark: remark,
          // Only meaningful while the candidate currently sits at 'Not Contactable' — clear
          // it on any other status so a stale reason doesn't linger once the situation changes.
          not_contactable_reason: status === 'Not Contactable' ? notContactableReason : null,
          updated_at: new Date()
        });
        // Setting status to 'Call Back' schedules the callback in the same step, instead of
        // requiring a separate Follow-up action after the fact.
        if (status === 'Call Back') {
          await trx('hiring_follow_ups').insert({
            id: randomUUID(), candidate_id: req.params.id, recruiter_id: assignment.recruiter_id,
            follow_up_date: new Date(followUpDate), notes: remark, completed: false, created_at: new Date()
          });
        }
      } else {
        await trx('hiring_closures').insert({
          id: randomUUID(),
          candidate_id: req.params.id,
          company_id: assignment.company_id,
          recruiter_id: assignment.recruiter_id,
          final_status: status,
          created_at: new Date(),
          closed_at: new Date()
        });
        await trx('hiring_candidate_assignments').where({ candidate_id: req.params.id }).delete();
      }

      await logHiringActivity(trx, req.params.id, assignment.recruiter_id, 'status_change', `Pipeline status changed to: ${status} — ${remark}`);
    });
    res.json({ id: req.params.id, message: 'Status updated' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to update status' });
  }
});

// POST /api/hiring/candidates/:id/log-call — quick "call made" activity entry, feeds the
// Daily Calls report (which counts action='call' rows) without requiring a full pipeline
// status change every time a recruiter makes a call.
router.post('/candidates/:id/log-call', requireRole(['super_admin', 'hiring_team_leader', 'recruiter']), async (req, res) => {
  const { notes } = req.body;
  try {
    const assignment = await db('hiring_candidate_assignments').where({ candidate_id: req.params.id }).first();
    if (!assignment) return res.status(404).json({ error: 'Candidate is not currently assigned.' });
    if (req.user.role !== 'super_admin' && !(await canAccessCandidate(req.user, req.params.id))) {
      return res.status(403).json({ error: 'You do not have access to this candidate.' });
    }
    await logHiringActivity(db, req.params.id, assignment.recruiter_id, 'call', notes || 'Call logged.');
    res.status(201).json({ message: 'Call logged' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to log call' });
  }
});

// GET /api/hiring/candidates/:id/remarks — activity history
router.get('/candidates/:id/remarks', requireRole(['super_admin', 'hiring_team_leader', 'recruiter']), async (req, res) => {
  try {
    const logs = await db('hiring_activity_log')
      .leftJoin('users', 'hiring_activity_log.recruiter_id', 'users.id')
      .where({ candidate_id: req.params.id })
      .select('hiring_activity_log.*', 'users.name as recruiter_name')
      .orderBy('timestamp', 'desc');
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch remarks' });
  }
});

// POST /api/hiring/candidates/:id/follow-up
router.post('/candidates/:id/follow-up', requireRole(['super_admin', 'hiring_team_leader', 'recruiter']), async (req, res) => {
  const { followUpDate, notes } = req.body;
  if (!followUpDate || isNaN(new Date(followUpDate).getTime())) {
    return res.status(400).json({ error: 'A valid followUpDate is required.' });
  }
  try {
    const assignment = await db('hiring_candidate_assignments').where({ candidate_id: req.params.id }).first();
    if (!assignment) return res.status(404).json({ error: 'Candidate is not currently assigned.' });
    if (req.user.role !== 'super_admin' && !(await canAccessCandidate(req.user, req.params.id))) {
      return res.status(403).json({ error: 'You do not have access to this candidate.' });
    }
    const id = randomUUID();
    await db('hiring_follow_ups').insert({
      id, candidate_id: req.params.id, recruiter_id: assignment.recruiter_id,
      follow_up_date: new Date(followUpDate), notes: notes || null, completed: false, created_at: new Date()
    });
    await logHiringActivity(db, req.params.id, assignment.recruiter_id, 'follow_up', `Follow-up scheduled: ${followUpDate}`);
    res.status(201).json({ id, message: 'Follow-up scheduled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to schedule follow-up' });
  }
});

// GET /api/hiring/follow-ups?pending=true — dedicated Callbacks list view, mirrors
// GET /interviews?upcoming=true (same shape: a full list vs a filtered "still needs
// attention" view, joined with candidate name/phone so it's readable at a glance).
router.get('/follow-ups', requireRole(['super_admin', 'hiring_team_leader', 'recruiter']), async (req, res) => {
  try {
    let query = db('hiring_follow_ups')
      .join('hiring_candidates', 'hiring_follow_ups.candidate_id', 'hiring_candidates.id')
      .select('hiring_follow_ups.*', 'hiring_candidates.name as candidate_name', 'hiring_candidates.phone as candidate_phone', 'hiring_candidates.email as candidate_email');

    if (req.user.role === 'recruiter') {
      query = query.where('hiring_follow_ups.recruiter_id', req.user.id);
    } else if (req.user.role === 'hiring_team_leader') {
      if (!req.user.hiring_team_id) return res.json([]);
      const teamRecruiterIds = db('users').where({ hiring_team_id: req.user.hiring_team_id, role: 'recruiter' }).select('id');
      query = query.whereIn('hiring_follow_ups.recruiter_id', teamRecruiterIds);
    }

    if (req.query.pending === 'true') {
      query = query.where('hiring_follow_ups.completed', false);
    }

    const followUps = await query.orderBy('follow_up_date', 'asc');
    res.json(followUps);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch follow-ups' });
  }
});

// PUT /api/hiring/follow-ups/:id/complete
router.put('/follow-ups/:id/complete', requireRole(['super_admin', 'hiring_team_leader', 'recruiter']), async (req, res) => {
  try {
    const followUp = await db('hiring_follow_ups').where({ id: req.params.id }).first();
    if (!followUp) return res.status(404).json({ error: 'Follow-up not found' });
    if (req.user.role !== 'super_admin' && !(await canAccessCandidate(req.user, followUp.candidate_id))) {
      return res.status(403).json({ error: 'You do not have access to this follow-up.' });
    }
    await db('hiring_follow_ups').where({ id: req.params.id }).update({ completed: true, completed_at: new Date() });
    res.json({ message: 'Follow-up marked complete' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to complete follow-up' });
  }
});

module.exports = router;
