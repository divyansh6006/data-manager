/**
 * ============================================================================
 * Skill Labs Data Manager - Core Application Service
 *
 * Designed and Developed by:
 *   DIVYANSH KUMAR SHARMA
 *   Associate Product Manager - AI Product and Platforms
 *   Skill Labs Resource Service Private Limited
 *   Phone: +91 6006291486
 *   Email: divyansh6005@gmail.com
 *
 * Description:
 *   Main Express entry point. Exposes rest API endpoints for lead operations,
 *   role assignments, university listings, closures, and file import parser.
 *
 * Copyright (c) 2026. All rights reserved.
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const xlsx = require('xlsx');
const { randomUUID } = require('crypto');
const db = require('./db');
const { authenticateToken, requireRole, generateToken } = require('./auth');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Restrict CORS to an explicit allow-list. Origins are supplied via the
// CORS_ORIGIN env var (comma-separated) and fall back to common localhost
// dev servers so the existing frontend keeps working out of the box.
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser / same-origin requests (no Origin header) such as curl or mobile apps.
    // Disallowed origins get `false` (no CORS headers set, silently blocked by the browser)
    // rather than an Error, which would otherwise fall through to Express's default error
    // handler and return a raw 500 with a stack trace.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true
}));
app.use(express.json());

// Configure multer for file upload in memory with bounded size and Excel-only filter
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }, // 10 MB per file, single file
  fileFilter: (req, file, cb) => {
    // Accept only spreadsheet files; reject others gracefully (handler returns "No file uploaded")
    if (/\.(xlsx|xls|csv)$/i.test(file.originalname)) {
      return cb(null, true);
    }
    return cb(null, false);
  }
});

// --- UTILITY FUNCTIONS ---

// Helper to write activity log within a transaction
async function logActivity(trx, leadId, counselorId, action, remark) {
  await trx('lead_activity_log').insert({
    id: randomUUID(),
    lead_id: leadId,
    counselor_id: counselorId,
    action,
    remark,
    timestamp: new Date()
  });
}

// Clean phone format (keep only digits, check length, remove Excel decimal suffixes & scientific notation)
function cleanPhone(phone) {
  if (!phone) return '';
  let str = String(phone).trim();
  
  // Handle scientific notation (e.g. 9.87654e+09)
  if (str.toLowerCase().includes('e+')) {
    const num = Number(str);
    if (!isNaN(num)) {
      str = String(num);
    }
  }
  
  if (str.endsWith('.0')) {
    str = str.substring(0, str.length - 2);
  }
  const digits = str.replace(/\D/g, '');
  return digits;
}

// Check email domain restriction
function isValidDomain(email) {
  if (!email) return false;
  return email.toLowerCase().endsWith('@company.com');
}

// Header aliases for auto-matching Excel headers to system fields
const FIELD_ALIASES = {
  name: ['name', 'candidatename', 'candidate', 'fullname', 'username', 'studentname', 'firstname', 'first', 'lastname', 'last'],
  phone: ['phone', 'phoneno', 'mobile', 'mobileno', 'contact', 'contactno', 'contactnumber', 'phonenumber', 'mobilenumber', 'number', 'telephone'],
  email: ['email', 'emailid', 'emailaddress', 'e-mail', 'mail', 'mailid'],
  city: ['city', 'currentlocation', 'currentcity', 'hometown', 'hometowncity', 'location', 'cityname', 'candidatecity', 'town', 'address'],
  state: ['state', 'currentstate', 'region', 'statename', 'province'],
  experience: ['experience', 'totalexperience', 'exp', 'yearsofexperience', 'experienceyrs', 'experienceyears', 'workexperience'],
  current_company: ['company', 'currentcompany', 'organisation', 'org', 'workplace', 'employer'],
  salary: ['salary', 'budget', 'income', 'ctc', 'currentctc', 'ctclpa'],
  graduation: ['graduation', 'education', 'degree', 'qualification', 'stream'],
  course_interest: ['courseinterest', 'course', 'program', 'interestedcourse', 'interestedin', 'preferredcourse', 'course_interest'],
  source: ['source', 'leadsource', 'utmsource', 'platform']
};

function normalizeHeader(header) {
  if (!header) return '';
  return String(header)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Pre-normalize all field aliases for efficient matching
const NORMALIZED_ALIASES = {};
for (const [field, list] of Object.entries(FIELD_ALIASES)) {
  NORMALIZED_ALIASES[field] = list.map(normalizeHeader);
}

function autoMapHeaders(headers) {
  const mapping = {};
  for (const field of Object.keys(FIELD_ALIASES)) {
    mapping[field] = null;
  }
  for (const header of headers) {
    const norm = normalizeHeader(header);
    for (const [field, aliases] of Object.entries(NORMALIZED_ALIASES)) {
      if (aliases.includes(norm) && mapping[field] === null) {
        mapping[field] = header;
        break;
      }
    }
  }
  return mapping;
}

function parseExperience(val) {
  if (val === undefined || val === null) return null;
  const str = String(val).trim().toLowerCase();
  if (str === '') return null;
  if (/^\d+(\.\d+)?$/.test(str)) return parseFloat(str);

  let years = 0, months = 0, matched = false;
  const yearMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:year|yr)/i);
  const monthMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:month|mo)/i);

  if (yearMatch) {
    years = parseFloat(yearMatch[1]);
    matched = true;
  }
  if (monthMatch) {
    months = parseFloat(monthMatch[1]);
    matched = true;
  }

  if (matched) return parseFloat((years + months / 12).toFixed(2));

  const startNumMatch = str.match(/^(\d+(?:\.\d+)?)/);
  if (startNumMatch) return parseFloat(startNumMatch[1]);

  return NaN;
}


// --- AUTH API ENDPOINTS ---

// Mock SSO Login endpoint
app.post('/api/auth/login', async (req, res) => {
  const { email, deviceId, force } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (!isValidDomain(email)) {
    return res.status(400).json({ error: 'Access restricted: Only @company.com accounts are permitted.' });
  }

  try {
    const user = await db('users').where({ company_email: email }).first();

    if (!user) {
      return res.status(404).json({ error: 'User account not registered in system.' });
    }

    if (!user.active) {
      return res.status(403).json({ error: 'Your account is currently deactivated.' });
    }

    // Session conflict check
    if (user.device_id && user.device_id !== deviceId && !force) {
      return res.status(409).json({
        error: 'Active session detected on another device.',
        message: 'Do you want to terminate that session and login here?'
      });
    }

    // Overwrite device_id (session footprint)
    await db('users').where({ id: user.id }).update({
      device_id: deviceId,
      updated_at: new Date()
    });

    // Write login activity with user ID recorded
    await db('lead_activity_log').insert({
      id: randomUUID(),
      lead_id: null,
      counselor_id: user.id,
      action: 'login',
      remark: `${user.name} (${user.role}) logged in — Device: ${deviceId}`,
      timestamp: new Date()
    });

    const token = generateToken(user, deviceId);
    
    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.company_email,
        role: user.role,
        team_id: user.team_id
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// Logout endpoint
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    // Log logout event
    await db('lead_activity_log').insert({
      id: randomUUID(),
      lead_id: null,
      counselor_id: req.user.id,
      action: 'logout',
      remark: `${req.user.name} (${req.user.role}) logged out`,
      timestamp: new Date()
    });
    await db('users').where({ id: req.user.id }).update({ device_id: null });
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error during logout' });
  }
});

// Get profile
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve current user session profile' });
  }
});

// Get team counselors
app.get('/api/users/counselors', authenticateToken, requireRole(['super_admin', 'manager', 'team_leader']), async (req, res) => {
  try {
    let query = db('users').where({ role: 'counselor', active: true });
    
    // Team leaders only see counselors in their team
    if (req.user.role === 'team_leader') {
      if (!req.user.team_id) {
        return res.json([]);
      }
      query = query.where({ team_id: req.user.team_id });
    }

    const counselors = await query;
    const counselorIds = counselors.map(c => c.id);

    if (counselorIds.length === 0) {
      return res.json([]);
    }

    // Include current load (count of active assignments)
    const assignments = await db('lead_assignments')
      .whereIn('counselor_id', counselorIds)
      .groupBy('counselor_id')
      .select('counselor_id')
      .count('id as load');

    const loadMap = {};
    assignments.forEach(a => {
      loadMap[a.counselor_id] = parseInt(a.load, 10);
    });

    // Include monthly targets
    const currentMonth = new Date().toISOString().substring(0, 7);
    const targets = await db('targets')
      .whereIn('counselor_id', counselorIds)
      .andWhere({ target_month: currentMonth });

    const targetMap = {};
    targets.forEach(t => {
      targetMap[t.counselor_id] = t.target_count;
    });

    const result = counselors.map(c => ({
      ...c,
      load: loadMap[c.id] || 0,
      monthlyTarget: targetMap[c.id] || 10
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch counselors list' });
  }
});


// --- UNIVERSITIES MANAGEMENT ---

// List all universities (accessible by all authenticated users)
app.get('/api/universities', authenticateToken, async (req, res) => {
  try {
    const list = await db('universities').orderBy('name', 'asc');
    const parsed = list.map(u => ({
      ...u,
      courses: typeof u.courses === 'string' ? JSON.parse(u.courses) : u.courses,
      fees: typeof u.fees === 'string' ? JSON.parse(u.fees) : u.fees,
      specializations: typeof u.specializations === 'string' ? JSON.parse(u.specializations) : u.specializations
    }));
    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch universities list' });
  }
});

// Create a new university
app.post('/api/admin/universities', authenticateToken, requireRole(['super_admin', 'manager']), async (req, res) => {
  const { name, courses, fees, eligibility, specializations } = req.body;
  if (!name || !courses) {
    return res.status(400).json({ error: 'Name and courses are required.' });
  }
  try {
    const existing = await db('universities').where({ name: name.trim() }).first();
    if (existing) {
      return res.status(400).json({ error: 'A university with this name already exists.' });
    }
    const id = randomUUID();
    const isSQLite = db.client.config.client === 'sqlite3';
    await db('universities').insert({
      id,
      name: name.trim(),
      courses: isSQLite ? JSON.stringify(courses) : courses,
      fees: fees ? (isSQLite ? JSON.stringify(fees) : fees) : null,
      eligibility: eligibility ? eligibility.trim() : null,
      specializations: specializations ? (isSQLite ? JSON.stringify(specializations) : specializations) : null,
      created_at: new Date()
    });

    await logActivity(db, null, req.user.id, 'note', `Created university ${name.trim()}`);

    res.status(201).json({ id, name, courses, fees, eligibility, specializations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create university' });
  }
});

// Update a university
app.put('/api/admin/universities/:id', authenticateToken, requireRole(['super_admin', 'manager']), async (req, res) => {
  const { id } = req.params;
  const { name, courses, fees, eligibility, specializations } = req.body;
  if (!name || !courses) {
    return res.status(400).json({ error: 'Name and courses are required.' });
  }
  try {
    const existing = await db('universities').where({ id }).first();
    if (!existing) {
      return res.status(404).json({ error: 'University not found' });
    }
    const isSQLite = db.client.config.client === 'sqlite3';
    await db('universities').where({ id }).update({
      name: name.trim(),
      courses: isSQLite ? JSON.stringify(courses) : courses,
      fees: fees ? (isSQLite ? JSON.stringify(fees) : fees) : null,
      eligibility: eligibility ? eligibility.trim() : null,
      specializations: specializations ? (isSQLite ? JSON.stringify(specializations) : specializations) : null
    });

    await logActivity(db, null, req.user.id, 'note', `Updated university ${name.trim()}`);

    res.json({ id, name, courses, fees, eligibility, specializations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update university' });
  }
});

// Delete a university
app.delete('/api/admin/universities/:id', authenticateToken, requireRole(['super_admin', 'manager']), async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await db('universities').where({ id }).first();
    if (!existing) {
      return res.status(404).json({ error: 'University not found' });
    }
    await db('universities').where({ id }).delete();

    await logActivity(db, null, req.user.id, 'note', `Deleted university ${existing.name}`);

    res.json({ message: 'University deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete university' });
  }
});


// --- ADMIN USER & TEAM MANAGEMENT ---

// List all users
app.get('/api/admin/users', authenticateToken, requireRole(['super_admin']), async (req, res) => {
  try {
    const users = await db('users')
      .leftJoin('teams', 'users.team_id', 'teams.id')
      .select('users.*', 'teams.name as team_name')
      .orderBy('users.created_at', 'desc');
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users list' });
  }
});

// Create a new user (counselor, manager, team_leader, super_admin)
app.post('/api/admin/users', authenticateToken, requireRole(['super_admin']), async (req, res) => {
  const { name, email, role, teamId } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Name, company email, and role are required.' });
  }
  if (!isValidDomain(email)) {
    return res.status(400).json({ error: 'Invalid email domain. Only @company.com is allowed.' });
  }
  try {
    const existing = await db('users').where({ company_email: email.trim().toLowerCase() }).first();
    if (existing) {
      return res.status(400).json({ error: 'A user with this email already exists.' });
    }
    const newUserId = randomUUID();
    await db('users').insert({
      id: newUserId,
      name: name.trim(),
      company_email: email.trim().toLowerCase(),
      role,
      team_id: teamId || null,
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    });

    await db('lead_activity_log').insert({
      id: randomUUID(),
      action: 'note',
      remark: `Created user ${name.trim()} as ${role}`,
      timestamp: new Date()
    });

    res.status(201).json({ id: newUserId, name, email, role, teamId, active: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create user account' });
  }
});

// Toggle active/inactive status of a user
app.put('/api/admin/users/:id/toggle', authenticateToken, requireRole(['super_admin']), async (req, res) => {
  const { id } = req.params;
  try {
    const user = await db('users').where({ id }).first();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot deactivate your own account.' });
    }
    const newStatus = !user.active;
    await db('users').where({ id }).update({
      active: newStatus,
      updated_at: new Date()
    });

    await db('lead_activity_log').insert({
      id: randomUUID(),
      action: 'note',
      remark: `${newStatus ? 'Activated' : 'Deactivated'} user account ${user.name}`,
      timestamp: new Date()
    });

    res.json({ id, active: newStatus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// List all teams
app.get('/api/admin/teams', authenticateToken, requireRole(['super_admin']), async (req, res) => {
  try {
    const teams = await db('teams').select('*').orderBy('name', 'asc');
    res.json(teams);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});


// --- LEAD UPLOAD & EXCEL PARSING ---

app.post('/api/leads/upload-preview', authenticateToken, requireRole(['super_admin', 'manager']), upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Uploaded sheet is empty' });
    }

    const headers = Object.keys(rows[0]);
    const autoMapping = autoMapHeaders(headers);
    const previewRows = rows.slice(0, 5);

    const systemFields = [
      { key: 'name', label: 'Candidate Name', required: true },
      { key: 'phone', label: 'Phone Number', required: true },
      { key: 'email', label: 'Email ID', required: false },
      { key: 'city', label: 'City', required: false },
      { key: 'state', label: 'State', required: false },
      { key: 'experience', label: 'Experience (Yrs)', required: false },
      { key: 'current_company', label: 'Current Company', required: false },
      { key: 'salary', label: 'Salary/CTC', required: false },
      { key: 'graduation', label: 'Graduation/Degree', required: false },
      { key: 'course_interest', label: 'Course Interest', required: false },
      { key: 'source', label: 'Lead Source', required: false }
    ];

    res.json({
      headers,
      previewRows,
      autoMapping,
      systemFields
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to parse Excel file preview.' });
  }
});

app.post('/api/leads/upload', authenticateToken, requireRole(['super_admin', 'manager']), upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Uploaded sheet is empty' });
    }

    const batchId = randomUUID();
    const cleanLeads = [];
    const duplicateLeads = [];
    const invalidLeads = [];
    const invalidDetails = [];
    const processedPhones = new Set();
    const processedEmails = new Set();

    // Fetch existing clean phone and emails for duplicate check
    const existingLeads = await db('leads')
      .where({ status: 'clean' })
      .select('phone', 'email');
    
    const existingPhones = new Set(existingLeads.map(l => l.phone));
    const existingEmails = new Set(existingLeads.filter(l => l.email).map(l => l.email.toLowerCase()));

    // Resolve column mapping
    const headers = Object.keys(rows[0]);
    const autoMapping = autoMapHeaders(headers);
    const finalMapping = {};
    const systemFieldsKeys = ['name', 'phone', 'email', 'city', 'state', 'experience', 'current_company', 'salary', 'graduation', 'course_interest', 'source'];

    if (req.body.mapping) {
      try {
        const userMap = typeof req.body.mapping === 'string' ? JSON.parse(req.body.mapping) : req.body.mapping;
        for (const key of systemFieldsKeys) {
          finalMapping[key] = userMap[key] || null;
        }
      } catch (e) {
        console.error('Failed to parse mapping body:', e);
        Object.assign(finalMapping, autoMapping);
      }
    } else {
      Object.assign(finalMapping, autoMapping);
    }

    rows.forEach((row, index) => {
      // Check if row has any non-empty cell value, otherwise skip
      const hasAnyValue = Object.values(row).some(val => val !== undefined && val !== null && String(val).trim() !== '');
      if (!hasAnyValue) {
        return;
      }

      const rowNum = index + 2;

      // Extract values based on finalMapping
      const getVal = (field) => {
        const mappedHeader = finalMapping[field];
        if (!mappedHeader) return null;
        const val = row[mappedHeader];
        return val !== undefined && val !== null ? val : null;
      };

      const nameVal = getVal('name');
      const phoneRaw = getVal('phone');
      const emailRaw = getVal('email');
      const cityRaw = getVal('city');
      const stateRaw = getVal('state');
      const expVal = getVal('experience');
      const companyRaw = getVal('current_company');
      const salVal = getVal('salary');
      const gradRaw = getVal('graduation');
      const interestRaw = getVal('course_interest');
      const sourceRaw = getVal('source');

      const name = nameVal ? String(nameVal).trim() : '';
      const phone = cleanPhone(phoneRaw);
      const email = emailRaw ? String(emailRaw).trim().toLowerCase() : null;

      let city = cityRaw ? String(cityRaw).trim() : null;
      let state = stateRaw ? String(stateRaw).trim() : null;

      let experience = null;
      let experienceInvalid = false;
      if (expVal !== null && String(expVal).trim() !== '') {
        const parsedExp = parseExperience(expVal);
        if (isNaN(parsedExp)) {
          experienceInvalid = true;
        } else {
          experience = parsedExp;
        }
      }

      let salary = 0;
      if (salVal !== null && String(salVal).trim() !== '') {
        const parsedSal = parseFloat(salVal);
        if (!isNaN(parsedSal)) salary = parsedSal;
      }

      const company = companyRaw ? String(companyRaw).trim() : null;
      const graduation = gradRaw ? String(gradRaw).trim() : null;
      const interest = interestRaw ? String(interestRaw).trim() : null;
      const source = sourceRaw ? String(sourceRaw).trim() : 'Excel Upload';

      // Validate required fields & experience
      let isInvalid = false;
      let invalidReason = '';

      if (!name) {
        isInvalid = true;
        invalidReason = 'Missing required field: Candidate Name';
      } else if (!phone) {
        isInvalid = true;
        invalidReason = 'Missing required field: Phone Number';
      } else if (experienceInvalid) {
        isInvalid = true;
        invalidReason = `Unparseable experience value: '${expVal}'`;
      }

      if (isInvalid) {
        invalidLeads.push({
          id: randomUUID(),
          name: name || 'Unknown',
          phone: phoneRaw ? String(phoneRaw).trim() : '',
          email,
          city,
          state,
          experience: null,
          current_company: company,
          salary,
          graduation,
          course_interest: interest,
          source,
          upload_batch_id: batchId,
          status: 'invalid',
          created_at: new Date(),
          updated_at: new Date()
        });
        invalidDetails.push({
          rowNumber: rowNum,
          name: name || 'Unknown',
          reason: invalidReason
        });
        return;
      }

      // Check duplicates (within file or in DB)
      const isFileDuplicate = processedPhones.has(phone) || (email && processedEmails.has(email));
      const isDbDuplicate = existingPhones.has(phone) || (email && existingEmails.has(email));

      const leadRecord = {
        id: randomUUID(),
        name,
        phone,
        email,
        city,
        state,
        experience,
        current_company: company,
        salary,
        graduation,
        course_interest: interest,
        source,
        upload_batch_id: batchId,
        created_at: new Date(),
        updated_at: new Date()
      };

      if (isFileDuplicate || isDbDuplicate) {
        leadRecord.status = 'duplicate';
        duplicateLeads.push(leadRecord);
      } else {
        leadRecord.status = 'clean';
        cleanLeads.push(leadRecord);
        processedPhones.add(phone);
        if (email) processedEmails.add(email);
      }
    });

    // Write in transaction
    await db.transaction(async (trx) => {
      // 1. Create upload batch record
      await trx('upload_batches').insert({
        id: batchId,
        uploaded_by: req.user.id,
        file_name: req.file.originalname,
        upload_date: new Date(),
        total_rows: rows.length,
        clean_rows: cleanLeads.length,
        duplicate_rows: duplicateLeads.length,
        invalid_rows: invalidLeads.length
      });

      // 2. Insert leads in batches
      const allLeads = [...cleanLeads, ...duplicateLeads, ...invalidLeads];
      
      const chunkSize = 100;
      for (let i = 0; i < allLeads.length; i += chunkSize) {
        await trx('leads').insert(allLeads.slice(i, i + chunkSize));
      }

      // 3. Log the upload batch event
      await logActivity(trx, null, req.user.id, 'call', `Uploaded excel batch: ${req.file.originalname} (Clean: ${cleanLeads.length}, Duplicates: ${duplicateLeads.length}, Invalid: ${invalidLeads.length})`);
    });

    res.json({
      batchId,
      total: rows.length,
      clean: cleanLeads.length,
      duplicate: duplicateLeads.length,
      invalid: invalidLeads.length,
      invalidDetails
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Excel file parsing failed' });
  }
});


// --- EXPORT LEADS TO EXCEL ---

// Export a specific batch — log download event
app.get('/api/leads/export/batch/:batchId', authenticateToken, requireRole(['super_admin', 'manager']), async (req, res) => {
  const { batchId } = req.params;
  try {
    const batch = await db('upload_batches').where({ id: batchId }).first();
    if (!batch) {
      return res.status(404).json({ error: 'Upload batch not found' });
    }

    // Log the download event
    await db('lead_activity_log').insert({
      id: randomUUID(),
      lead_id: null,
      counselor_id: req.user.id,
      action: 'download',
      remark: `Downloaded batch export: ${batch.file_name} (${batch.clean_rows} leads)`,
      timestamp: new Date()
    });

    const leads = await db('leads')
      .leftJoin('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .leftJoin('users', 'lead_assignments.counselor_id', 'users.id')
      .leftJoin('universities', 'leads.university_id', 'universities.id')
      .select(
        'leads.name as Candidate Name',
        'leads.phone as Phone',
        'leads.email as Email',
        'leads.city as City',
        'leads.state as State',
        'leads.experience as Experience (Yrs)',
        'leads.current_company as Current Company',
        'leads.salary as Salary/CTC',
        'leads.graduation as Graduation/Degree',
        'leads.course_interest as Course Interest',
        'universities.name as Interested University',
        'leads.source as Lead Source',
        'users.name as Assigned Counselor',
        'lead_assignments.stage as Pipeline Stage',
        'leads.status as Data Status',
        'leads.created_at as Upload Date'
      )
      .where({ 'leads.upload_batch_id': batchId })
      .orderBy('leads.created_at', 'asc');

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(leads);
    xlsx.utils.book_append_sheet(wb, ws, "Leads");
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const safeFileName = batch.file_name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="export_${safeFileName}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error('Batch export failed:', err);
    res.status(500).json({ error: 'Failed to export batch data to Excel' });
  }
});

// Export all leads — log download event
app.get('/api/leads/export/all', authenticateToken, requireRole(['super_admin', 'manager']), async (req, res) => {
  try {
    // Log the download event
    await db('lead_activity_log').insert({
      id: randomUUID(),
      lead_id: null,
      counselor_id: req.user.id,
      action: 'download',
      remark: `Downloaded full leads export (all data)`,
      timestamp: new Date()
    });
    const leads = await db('leads')
      .leftJoin('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .leftJoin('users', 'lead_assignments.counselor_id', 'users.id')
      .leftJoin('universities', 'leads.university_id', 'universities.id')
      .select(
        'leads.name as Candidate Name',
        'leads.phone as Phone',
        'leads.email as Email',
        'leads.city as City',
        'leads.state as State',
        'leads.experience as Experience (Yrs)',
        'leads.current_company as Current Company',
        'leads.salary as Salary/CTC',
        'leads.graduation as Graduation/Degree',
        'leads.course_interest as Course Interest',
        'universities.name as Interested University',
        'leads.source as Lead Source',
        'users.name as Assigned Counselor',
        'lead_assignments.stage as Pipeline Stage',
        'leads.status as Data Status',
        'leads.created_at as Upload Date'
      )
      .orderBy('leads.created_at', 'asc');

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(leads);
    xlsx.utils.book_append_sheet(wb, ws, "All Leads");
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="all_leads_export.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error('All leads export failed:', err);
    res.status(500).json({ error: 'Failed to export all leads data to Excel' });
  }
});


// --- LEAD POOL FILTERING ---

app.get('/api/leads/pool', authenticateToken, requireRole(['super_admin', 'manager']), async (req, res) => {
  const { location, city, state, source, interest, start_date, end_date, min_exp, max_exp, university_id, upload_batch_id } = req.query;

  try {
    // Lead is available for distribution if status = 'clean' and NOT assigned
    let query = db('leads')
      .leftJoin('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .leftJoin('universities', 'leads.university_id', 'universities.id')
      .where({ 'leads.status': 'clean' })
      .whereNull('lead_assignments.id')
      .select('leads.*', 'universities.name as university_name');

    if (location) {
      const locLower = String(location).toLowerCase();
      query = query.where(function() {
        this.where(db.raw('LOWER(leads.city)'), 'like', `%${locLower}%`)
            .orWhere(db.raw('LOWER(leads.state)'), 'like', `%${locLower}%`);
      });
    }

    if (city) {
      query = query.where(db.raw('LOWER(leads.city)'), '=', city.toLowerCase());
    }

    if (state) {
      query = query.where(db.raw('LOWER(leads.state)'), '=', state.toLowerCase());
    }

    if (source) {
      const srcLower = String(source).toLowerCase();
      query = query.where(db.raw('LOWER(leads.source)'), 'like', `%${srcLower}%`);
    }

    if (interest) {
      const intLower = String(interest).toLowerCase();
      query = query.where(db.raw('LOWER(leads.course_interest)'), 'like', `%${intLower}%`);
    }

    if (university_id) {
      query = query.where({ 'leads.university_id': university_id });
    }

    if (upload_batch_id) {
      query = query.where({ 'leads.upload_batch_id': upload_batch_id });
    }

    if (min_exp) {
      query = query.where('leads.experience', '>=', parseFloat(min_exp));
    }

    if (max_exp) {
      query = query.where('leads.experience', '<=', parseFloat(max_exp));
    }

    if (start_date) {
      query = query.where('leads.created_at', '>=', new Date(start_date));
    }

    if (end_date) {
      query = query.where('leads.created_at', '<=', new Date(end_date));
    }

    const pool = await query.orderBy('leads.created_at', 'asc');
    res.json(pool);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch lead pool' });
  }
});

// GET /api/leads/pool-filters — get unique filter options from the pool (optionally for a specific batch)
app.get('/api/leads/pool-filters', authenticateToken, requireRole(['super_admin', 'manager']), async (req, res) => {
  const { upload_batch_id } = req.query;
  try {
    let baseQuery = db('leads')
      .leftJoin('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .where({ 'leads.status': 'clean' })
      .whereNull('lead_assignments.id');

    if (upload_batch_id) {
      baseQuery = baseQuery.where({ 'leads.upload_batch_id': upload_batch_id });
    }

    const citiesQuery = baseQuery.clone().distinct('leads.city').whereNotNull('leads.city').whereNot('leads.city', '').orderBy('leads.city', 'asc');
    const statesQuery = baseQuery.clone().distinct('leads.state').whereNotNull('leads.state').whereNot('leads.state', '').orderBy('leads.state', 'asc');
    const coursesQuery = baseQuery.clone().distinct('leads.course_interest').whereNotNull('leads.course_interest').whereNot('leads.course_interest', '').orderBy('leads.course_interest', 'asc');
    const sourcesQuery = baseQuery.clone().distinct('leads.source').whereNotNull('leads.source').whereNot('leads.source', '').orderBy('leads.source', 'asc');

    const [cities, states, courses, sources] = await Promise.all([
      citiesQuery,
      statesQuery,
      coursesQuery,
      sourcesQuery
    ]);

    res.json({
      cities: cities.map(c => c.city),
      states: states.map(s => s.state),
      courses: courses.map(c => c.course_interest),
      sources: sources.map(s => s.source)
    });
  } catch (err) {
    console.error('Failed to fetch pool filters:', err);
    res.status(500).json({ error: 'Failed to fetch dynamic pool filters' });
  }
});


// --- MANUAL COUNT ALLOCATION DISTRIBUTION ---

app.post('/api/leads/distribute', authenticateToken, requireRole(['super_admin', 'manager']), async (req, res) => {
  const { allocations, filterCriteria, sourceBatchId } = req.body;
  // allocations is array of { counselorId, count }

  if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
    return res.status(400).json({ error: 'Allocations list is required' });
  }

  const totalRequested = allocations.reduce((sum, item) => sum + parseInt(item.count || 0, 10), 0);
  if (totalRequested <= 0) {
    return res.status(400).json({ error: 'Total requested allocation count must be greater than zero' });
  }

  try {
    await db.transaction(async (trx) => {
      // 1. Fetch available leads matching the criteria
      // Re-apply same pool logic inside transaction to prevent race conditions
      let query = trx('leads')
        .leftJoin('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
        .where({ 'leads.status': 'clean' })
        .whereNull('lead_assignments.id')
        .select('leads.id')
        .forUpdate(); // Lock leads rows during transaction!

      if (sourceBatchId) {
        query = query.where({ 'leads.upload_batch_id': sourceBatchId });
      }

      const availableLeads = await query.orderBy('leads.created_at', 'asc');

      if (availableLeads.length < totalRequested) {
        throw new Error(`Insufficient leads in the pool. Requested: ${totalRequested}, Available: ${availableLeads.length}`);
      }

      // Create distribution batch
      const distBatchId = randomUUID();
      await trx('distribution_batches').insert({
        id: distBatchId,
        source_batch_id: sourceBatchId || null,
        filter_criteria: JSON.stringify(filterCriteria || {}),
        total_leads: totalRequested,
        distributed_by: req.user.id,
        distributed_at: new Date(),
        status: 'confirmed'
      });

      let leadPointer = 0;

      for (const alloc of allocations) {
        const count = parseInt(alloc.count, 10);
        if (count <= 0) continue;

        // Verify counselor is active
        const counselor = await trx('users').where({ id: alloc.counselorId, role: 'counselor', active: true }).first();
        if (!counselor) {
          throw new Error(`Counselor ${alloc.counselorId} is not active or invalid.`);
        }

        const allocatedIds = [];
        for (let j = 0; j < count; j++) {
          const lead = availableLeads[leadPointer++];
          allocatedIds.push(lead.id);

          // Assign lead
          await trx('lead_assignments').insert({
            id: randomUUID(),
            lead_id: lead.id,
            counselor_id: counselor.id,
            assigned_by: req.user.id,
            assigned_at: new Date(),
            stage: 'L1',
            locked: true,
            updated_at: new Date()
          });

          // Log assignment activity
          await logActivity(trx, lead.id, counselor.id, 'distributed', `Lead allocated to counselor ${counselor.name} via Manual Count Allocation`);
        }

        // Insert allocation record
        await trx('distribution_allocations').insert({
          id: randomUUID(),
          distribution_batch_id: distBatchId,
          counselor_id: counselor.id,
          requested_count: count,
          actual_lead_ids: JSON.stringify(allocatedIds),
          created_at: new Date()
        });
      }
    });

    res.json({ message: `Successfully distributed ${totalRequested} leads.` });

  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Lead distribution failed' });
  }
});


// --- COUNSELOR DASHBOARD ---

// Get counselor leads
app.get('/api/counselor/leads', authenticateToken, requireRole(['counselor']), async (req, res) => {
  const { stage, is_due_followup } = req.query;

  try {
    let query = db('leads')
      .join('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .leftJoin('universities', 'leads.university_id', 'universities.id')
      .leftJoin('closures', 'leads.id', 'closures.lead_id')
      .where({ 'lead_assignments.counselor_id': req.user.id })
      .select(
        'leads.*',
        'lead_assignments.stage',
        'lead_assignments.locked',
        'lead_assignments.assigned_at',
        'lead_assignments.disposition as disposition',
        'universities.name as university_name',
        'closures.documents_status as documents_status',
        'closures.application_status as application_status',
        'closures.revenue as closure_revenue'
      );

    if (stage) {
      query = query.where({ 'lead_assignments.stage': stage });
    }

    let leads = await query.orderBy('leads.created_at', 'desc');

    // Filter followups
    if (is_due_followup === 'true') {
      const now = new Date();
      const followUps = await db('follow_ups')
        .where({ counselor_id: req.user.id, completed: false })
        .where('follow_up_date', '<=', now);
      
      const dueLeadIds = new Set(followUps.map(f => f.lead_id));
      leads = leads.filter(l => dueLeadIds.has(l.id));
    }

    res.json(leads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch counselor leads' });
  }
});

// Get counselor's dropped leads
app.get('/api/counselor/leads/dropped', authenticateToken, requireRole(['counselor']), async (req, res) => {
  try {
    const droppedLeads = await db('leads')
      .join('closures', 'leads.id', 'closures.lead_id')
      .leftJoin('universities', 'closures.university_id', 'universities.id')
      .where({ 
        'closures.counselor_id': req.user.id,
        'closures.final_status': 'lost'
      })
      .select(
        'leads.*',
        'closures.drop_stage',
        'closures.drop_remark',
        'closures.closed_at',
        'universities.name as university_name'
      )
      .orderBy('closures.closed_at', 'desc');

    res.json(droppedLeads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dropped leads' });
  }
});

// Get counselor's enrolled leads
app.get('/api/counselor/leads/enrolled', authenticateToken, requireRole(['counselor']), async (req, res) => {
  try {
    const enrolledLeads = await db('leads')
      .join('closures', 'leads.id', 'closures.lead_id')
      .leftJoin('universities', 'closures.university_id', 'universities.id')
      .where({ 
        'closures.counselor_id': req.user.id,
        'closures.final_status': 'enrolled'
      })
      .select(
        'leads.*',
        'closures.revenue as closure_revenue',
        'closures.documents_status as documents_status',
        'closures.closed_at',
        'universities.name as university_name'
      )
      .orderBy('closures.closed_at', 'desc');

    res.json(enrolledLeads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch enrolled leads' });
  }
});

// Update Call Quality / Disposition Status
app.put('/api/counselor/leads/:id/disposition', authenticateToken, requireRole(['counselor']), async (req, res) => {
  const leadId = req.params.id;
  const { disposition } = req.body;

  const validDispositions = ['None', 'Interested', 'Not Interested', 'Not Picked Up', 'Switched Off'];
  if (!disposition || !validDispositions.includes(disposition)) {
    return res.status(400).json({ error: 'Invalid quality status value' });
  }

  try {
    const affected = await db('lead_assignments')
      .where({ lead_id: leadId, counselor_id: req.user.id })
      .update({ disposition, updated_at: new Date() });

    if (!affected) {
      return res.status(404).json({ error: 'Lead assignment not found or access denied.' });
    }

    // Log status change in compliance log
    await db('lead_activity_log').insert({
      id: randomUUID(),
      lead_id: leadId,
      counselor_id: req.user.id,
      action: 'status_change',
      remark: `Call quality status changed to: ${disposition}`,
      timestamp: new Date()
    });

    res.json({ message: 'Quality status updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update quality status' });
  }
});

// Inline lead action (tick/cross/remark)
app.post('/api/counselor/leads/:id/action', authenticateToken, requireRole(['counselor']), async (req, res) => {
  const leadId = req.params.id;
  const { 
    outcome, 
    remark, 
    followUpDate, 
    universityId, 
    revenue, 
    docChecklist, 
    isWorkingPref, 
    budget, 
    isEligible, 
    reason,
    applicationStatus,
    courseDiscussed
  } = req.body;

  try {
    await db.transaction(async (trx) => {
      // 1. Verify owner and lock state
      const assignment = await trx('lead_assignments').where({ lead_id: leadId, counselor_id: req.user.id }).first();
      if (!assignment) {
        throw new Error('Access denied: You are not the owner of this lead.');
      }

      if (!assignment.locked) {
        throw new Error('This lead is not currently locked for counseling.');
      }

      const currentStage = assignment.stage;

      // Update interested university if provided
      if (universityId) {
        await trx('leads').where({ id: leadId }).update({
          university_id: universityId,
          updated_at: new Date()
        });
      }

      // Update course interest if provided
      if (courseDiscussed) {
        await trx('leads').where({ id: leadId }).update({
          course_interest: courseDiscussed,
          updated_at: new Date()
        });
      }

      if (outcome === 'remark') {
        // Just log remark
        await logActivity(trx, leadId, req.user.id, 'note', remark || 'Added remark');
      } 
      else if (outcome === 'cross') {
        // Close/Lost Lead with drop reason
        const dropReason = reason || 'Not interested';
        let leadStatus = 'closed';
        if (dropReason.toLowerCase().includes('duplicate')) {
          leadStatus = 'duplicate';
        } else if (dropReason.toLowerCase().includes('ineligible') || dropReason.toLowerCase().includes('wrong number')) {
          leadStatus = 'invalid';
        }

        // Update lead status
        await trx('leads').where({ id: leadId }).update({
          status: leadStatus,
          updated_at: new Date()
        });

        // Upsert closure record
        const existingClosure = await trx('closures').where({ lead_id: leadId }).first();
        if (existingClosure) {
          await trx('closures').where({ lead_id: leadId }).update({
            university_id: universityId || null,
            application_status: 'rejected',
            final_status: 'lost',
            revenue: 0.00,
            counselor_id: req.user.id,
            drop_stage: currentStage,
            drop_remark: remark || null,
            closed_at: new Date()
          });
        } else {
          await trx('closures').insert({
            id: randomUUID(),
            lead_id: leadId,
            university_id: universityId || null,
            documents_status: JSON.stringify({}),
            application_status: 'rejected',
            final_status: 'lost',
            revenue: 0.00,
            counselor_id: req.user.id,
            drop_stage: currentStage,
            drop_remark: remark || null,
            created_at: new Date(),
            closed_at: new Date()
          });
        }

        // Delete current assignment
        await trx('lead_assignments').where({ lead_id: leadId }).delete();
        await logActivity(trx, leadId, req.user.id, 'cross', remark || `Closed/Lost: ${dropReason}`);
      } 
      else if (outcome === 'tick') {
        // Advance Stage
        if (currentStage === 'L1') {
          // L1 -> L2 Triage
          await trx('lead_assignments').where({ lead_id: leadId }).update({
            stage: 'L2',
            updated_at: new Date()
          });

          // Optional: Update lead's salary parameter with their budget
          if (budget) {
            await trx('leads').where({ id: leadId }).update({
              salary: parseFloat(budget),
              updated_at: new Date()
            });
          }

          // Create follow-up schedule
          if (followUpDate) {
            await trx('follow_ups').insert({
              id: randomUUID(),
              lead_id: leadId,
              counselor_id: req.user.id,
              follow_up_date: new Date(followUpDate),
              notes: remark || 'Scheduled L2 Follow-up',
              completed: false,
              created_at: new Date()
            });
          }

          let triageUnivText = '';
          if (universityId) {
            const uRec = await trx('universities').where({ id: universityId }).first();
            if (uRec) triageUnivText = `, University Interest: ${uRec.name}`;
          }
          const triageNotes = `Qualified. [Working Pref: ${isWorkingPref ? 'Yes' : 'No'}, Budget: ₹${budget || 'N/A'}, Eligible: ${isEligible ? 'Yes' : 'No'}${triageUnivText}]. Notes: ${remark || ''}`;
          await logActivity(trx, leadId, req.user.id, 'tick', triageNotes);
        } 
        else if (currentStage === 'L2') {
          // L2 -> L3
          await trx('lead_assignments').where({ lead_id: leadId }).update({
            stage: 'L3',
            updated_at: new Date()
          });

          // Complete any pending follow-ups for this lead
          await trx('follow_ups')
            .where({ lead_id: leadId, counselor_id: req.user.id, completed: false })
            .update({ completed: true, completed_at: new Date() });

          // Save budget details if provided
          if (budget) {
            await trx('leads').where({ id: leadId }).update({
              salary: parseFloat(budget),
              updated_at: new Date()
            });
          }

          // Create draft closure record
          const existingClosure = await trx('closures').where({ lead_id: leadId }).first();
          const initialChecklist = {
            registrationNumber: '',
            degree: false,
            transcripts: false,
            idProof: false,
            workExp: false,
            documentsSubmitted: false,
            feesPaid: false,
            paymentMode: 'UPI',
            feeReceiptConfirmed: false,
            feesConfirmed: false
          };
          if (existingClosure) {
            await trx('closures').where({ lead_id: leadId }).update({
              university_id: universityId || existingClosure.university_id,
              documents_status: JSON.stringify(initialChecklist),
              application_status: 'Pending',
              final_status: 'pending_enrollment',
              counselor_id: req.user.id
            });
          } else {
            await trx('closures').insert({
              id: randomUUID(),
              lead_id: leadId,
              university_id: universityId || null,
              documents_status: JSON.stringify(initialChecklist),
              application_status: 'Pending',
              final_status: 'pending_enrollment',
              revenue: 0,
              counselor_id: req.user.id,
              created_at: new Date()
            });
          }

          let advUnivText = '';
          if (universityId) {
            const uRec = await trx('universities').where({ id: universityId }).first();
            if (uRec) advUnivText = `, University Interest: ${uRec.name}`;
          }
          const punchNotes = `Lead Punched & Advanced. [Working Pref: ${isWorkingPref ? 'Yes' : 'No'}, Budget: ₹${budget || 'N/A'}, Eligible: ${isEligible ? 'Yes' : 'No'}${advUnivText}]. Notes: ${remark || ''}`;
          await logActivity(trx, leadId, req.user.id, 'tick', punchNotes);
        } 
        else if (currentStage === 'L3') {
          // L3 step-by-step updates or final closure
          const isFinalEnrollment = !!(docChecklist && docChecklist.feesConfirmed);

          // Upsert closure record
          const existingClosure = await trx('closures').where({ lead_id: leadId }).first();
          if (existingClosure) {
            await trx('closures').where({ lead_id: leadId }).update({
              university_id: universityId || existingClosure.university_id,
              documents_status: JSON.stringify(docChecklist || {}),
              application_status: applicationStatus || existingClosure.application_status || 'Pending',
              final_status: isFinalEnrollment ? 'enrolled' : 'pending_enrollment',
              revenue: parseFloat(revenue || existingClosure.revenue || 0),
              counselor_id: req.user.id,
              closed_at: isFinalEnrollment ? new Date() : null
            });
          } else {
            await trx('closures').insert({
              id: randomUUID(),
              lead_id: leadId,
              university_id: universityId || null,
              documents_status: JSON.stringify(docChecklist || {}),
              application_status: applicationStatus || 'Pending',
              final_status: isFinalEnrollment ? 'enrolled' : 'pending_enrollment',
              revenue: parseFloat(revenue || 0),
              counselor_id: req.user.id,
              created_at: new Date(),
              closed_at: isFinalEnrollment ? new Date() : null
            });
          }

          if (isFinalEnrollment) {
            // Delete active assignment since it's fully closed
            await trx('lead_assignments').where({ lead_id: leadId }).delete();
            await logActivity(trx, leadId, req.user.id, 'tick', remark || 'Successfully closed lead: Enrolled');
          } else {
            // Just update updated_at on the assignment and log the step
            await trx('lead_assignments').where({ lead_id: leadId }).update({
              updated_at: new Date()
            });
            await logActivity(trx, leadId, req.user.id, 'note', remark || 'Updated L3 application steps');
          }
        }
      }
    });

    res.json({ message: 'Lead action recorded successfully.' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Action failed' });
  }
});

// Log call notes and schedule next follow-up date (L2)
app.post('/api/counselor/leads/:id/follow-up', authenticateToken, requireRole(['counselor']), async (req, res) => {
  const leadId = req.params.id;
  const { followUpDate, notes, universityDiscussed, courseDiscussed, feeDiscussed, universityId } = req.body;

  try {
    await db.transaction(async (trx) => {
      // 1. Verify owner
      const assignment = await trx('lead_assignments').where({ lead_id: leadId, counselor_id: req.user.id }).first();
      if (!assignment) {
        throw new Error('Access denied: You do not own this lead.');
      }

      // Update interested university if provided
      if (universityId) {
        await trx('leads').where({ id: leadId }).update({
          university_id: universityId,
          updated_at: new Date()
        });
      }

      // 2. Complete previous follow-ups for this lead
      await trx('follow_ups')
        .where({ lead_id: leadId, counselor_id: req.user.id, completed: false })
        .update({ completed: true, completed_at: new Date() });

      // 3. Create new follow-up if followUpDate is provided
      if (followUpDate) {
        await trx('follow_ups').insert({
          id: randomUUID(),
          lead_id: leadId,
          counselor_id: req.user.id,
          follow_up_date: new Date(followUpDate),
          notes: notes || 'Scheduled Follow-up',
          completed: false,
          created_at: new Date()
        });
      }

      // 4. Log call activity
      let uDiscussedText = universityDiscussed || 'None';
      if (universityId) {
        const uRec = await trx('universities').where({ id: universityId }).first();
        if (uRec) {
          uDiscussedText = uRec.name;
        }
      }

      const activityRemark = `Call logged. Next follow-up: ${followUpDate || 'None'}. Univ Discussed: ${uDiscussedText}, Course: ${courseDiscussed || 'None'}, Fee: ${feeDiscussed || 'None'}. Notes: ${notes || ''}`;
      await logActivity(trx, leadId, req.user.id, 'call', activityRemark);
    });

    res.json({ message: 'Call note logged and follow-up scheduled successfully.' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to log call' });
  }
});

// Get counselor personal performance statistics
app.get('/api/counselor/performance', authenticateToken, requireRole(['counselor']), async (req, res) => {
  try {
    // 1. Stage Counts from current active assignments
    const activeAssignments = await db('lead_assignments')
      .where({ counselor_id: req.user.id })
      .groupBy('stage')
      .select('stage')
      .count('id as count');

    const activeCounts = { L1: 0, L2: 0, L3: 0 };
    activeAssignments.forEach(a => {
      activeCounts[a.stage] = parseInt(a.count || 0, 10);
    });

    // 2. Closures (Enrolled vs Lost)
    const closuresSummary = await db('closures')
      .whereIn('lead_id', db('lead_activity_log').where({ counselor_id: req.user.id, action: 'tick' }).select('lead_id'))
      .groupBy('final_status')
      .select('final_status')
      .count('id as count')
      .sum('revenue as total_revenue');

    let enrolledCount = 0;
    let lostCount = 0;
    let totalRevenue = 0;

    closuresSummary.forEach(c => {
      if (c.final_status === 'enrolled') {
        enrolledCount = parseInt(c.count || 0, 10);
        totalRevenue = parseFloat(c.total_revenue || 0);
      } else if (c.final_status === 'lost') {
        lostCount = parseInt(c.count || 0, 10);
      }
    });

    // 3. Completed vs Pending Follow-ups
    const completedFollowups = await db('follow_ups')
      .where({ counselor_id: req.user.id, completed: true })
      .count('id as count')
      .first();
    
    const pendingFollowups = await db('follow_ups')
      .where({ counselor_id: req.user.id, completed: false })
      .count('id as count')
      .first();

    // 4. Monthly Target & Progress
    const currentMonth = new Date().toISOString().substring(0, 7); // e.g. "2026-07"
    const targetRecord = await db('targets')
      .where({ counselor_id: req.user.id, target_month: currentMonth })
      .first();
    const monthlyTarget = targetRecord ? targetRecord.target_count : 10; // default target is 10

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyEnrolledRecord = await db('closures')
      .whereIn('lead_id', db('lead_activity_log').where({ counselor_id: req.user.id, action: 'tick' }).select('lead_id'))
      .andWhere({ final_status: 'enrolled' })
      .andWhere('closed_at', '>=', startOfMonth)
      .count('id as count')
      .first();

    const monthlyEnrolledCount = parseInt(monthlyEnrolledRecord.count || 0, 10);
    const targetLeft = Math.max(0, monthlyTarget - monthlyEnrolledCount);

    res.json({
      activeAssignments: activeCounts,
      enrolledCount,
      lostCount,
      totalRevenue,
      completedFollowups: parseInt(completedFollowups.count || 0, 10),
      pendingFollowups: parseInt(pendingFollowups.count || 0, 10),
      monthlyTarget,
      monthlyEnrolledCount,
      targetLeft
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch counselor performance metrics' });
  }
});

// Manager updates counselor target count for a month
app.post('/api/manager/targets', authenticateToken, requireRole(['super_admin', 'manager', 'team_leader']), async (req, res) => {
  const { counselorId, targetCount, targetMonth } = req.body;
  if (!counselorId || !targetCount || !targetMonth) {
    return res.status(400).json({ error: 'counselorId, targetCount, and targetMonth are required.' });
  }
  if (req.user.role === 'team_leader') {
    const counselor = await db('users').where({ id: counselorId }).first();
    if (!counselor || counselor.team_id !== req.user.team_id) {
      return res.status(403).json({ error: 'Access denied: Counselor is not in your team.' });
    }
  }
  try {
    const existing = await db('targets').where({ counselor_id: counselorId, target_month: targetMonth }).first();
    if (existing) {
      await db('targets').where({ id: existing.id }).update({ target_count: parseInt(targetCount, 10) });
    } else {
      await db('targets').insert({
        id: randomUUID(),
        counselor_id: counselorId,
        target_count: parseInt(targetCount, 10),
        target_month: targetMonth,
        created_at: new Date()
      });
    }
    res.json({ message: 'Target count set successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to set counselor performance target.' });
  }
});

// Get list of dates counselor worked on (leads assigned) with summary statistics
app.get('/api/counselor/history/dates', authenticateToken, requireRole(['counselor']), async (req, res) => {
  try {
    const isSQLite = db.client.config.client === 'sqlite3';
    const dateExpr = isSQLite ? "DATE(timestamp / 1000, 'unixepoch')" : "DATE(timestamp)";

    // 1. Get all work history / activity actions for this counselor
    const assignments = await db('lead_activity_log')
      .where({ counselor_id: req.user.id })
      .whereNotNull('lead_id')
      .select('lead_id', db.raw(`${dateExpr} as date_assigned`))
      .groupBy('lead_id', db.raw(dateExpr));

    if (assignments.length === 0) {
      return res.json([]);
    }

    const leadIds = assignments.map(a => a.lead_id);

    // 2. Fetch current stages of these leads
    const activeStates = await db('lead_assignments')
      .whereIn('lead_id', leadIds)
      .select('lead_id', 'stage');
    const activeMap = {};
    activeStates.forEach(s => {
      activeMap[s.lead_id] = s.stage;
    });

    // 3. Fetch closures of these leads
    const closureStates = await db('closures')
      .whereIn('lead_id', leadIds)
      .select('lead_id', 'final_status');
    const closureMap = {};
    closureStates.forEach(c => {
      closureMap[c.lead_id] = c.final_status;
    });

    // 4. Group by date
    const dateGroups = {};
    assignments.forEach(a => {
      if (!a.date_assigned) return; // Skip if null
      const dStr = new Date(a.date_assigned).toISOString().split('T')[0];
      if (!dateGroups[dStr]) {
        dateGroups[dStr] = { date: dStr, total: 0, L1: 0, L2: 0, L3: 0, enrolled: 0, lost: 0 };
      }
      dateGroups[dStr].total++;
      const stage = activeMap[a.lead_id];
      const closure = closureMap[a.lead_id];

      if (stage) {
        dateGroups[dStr][stage]++;
      } else if (closure === 'enrolled') {
        dateGroups[dStr].enrolled++;
      } else {
        // Was dropped, lost, or crossed
        dateGroups[dStr].lost++;
      }
    });

    const result = Object.values(dateGroups).sort((a, b) => b.date.localeCompare(a.date));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch counselor date logs history' });
  }
});

// Get detailed leads list for a specific history date
app.get('/api/counselor/history/dates/:date', authenticateToken, requireRole(['counselor']), async (req, res) => {
  const { date } = req.params;
  try {
    const isSQLite = db.client.config.client === 'sqlite3';
    const dateExpr = isSQLite ? "DATE(timestamp / 1000, 'unixepoch')" : "DATE(timestamp)";

    const assignments = await db('lead_activity_log')
      .where({ counselor_id: req.user.id })
      .whereNotNull('lead_id')
      .andWhereRaw(`${dateExpr} = ?`, [date])
      .select('lead_id')
      .groupBy('lead_id');

    if (assignments.length === 0) {
      return res.json({ summary: { total: 0, L1: 0, L2: 0, L3: 0, enrolled: 0, lost: 0 }, leads: [] });
    }

    const leadIds = assignments.map(a => a.lead_id);

    const leadsData = await db('leads')
      .whereIn('leads.id', leadIds)
      .leftJoin('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .leftJoin('closures', 'leads.id', 'closures.lead_id')
      .leftJoin('universities', 'closures.university_id', 'universities.id')
      .select(
        'leads.*',
        'lead_assignments.stage',
        'lead_assignments.disposition',
        'closures.final_status as closure_status',
        'closures.revenue as closure_revenue',
        'universities.name as closure_university'
      )
      .orderBy('leads.created_at', 'desc');

    const summary = { total: leadsData.length, L1: 0, L2: 0, L3: 0, enrolled: 0, lost: 0 };
    leadsData.forEach(l => {
      if (l.stage) {
        summary[l.stage]++;
      } else if (l.closure_status === 'enrolled') {
        summary.enrolled++;
      } else {
        summary.lost++;
      }
    });

    res.json({ summary, leads: leadsData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch details for selected date' });
  }
});



// Get seeded/learned database locations
app.get('/api/location-learnings', authenticateToken, async (req, res) => {
  try {
    const list = await db('location_learnings').orderBy('city_name', 'asc');
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch location learnings.' });
  }
});



// --- TRANSFER REQUESTS & QUEUE ---

// Counselor requests transfer
app.post('/api/transfers/request', authenticateToken, requireRole(['counselor']), async (req, res) => {
  const { leadId, requestType, reason, note, targetCounselorId } = req.body;

  if (!leadId || !requestType || !reason) {
    return res.status(400).json({ error: 'leadId, requestType, and reason are required' });
  }

  try {
    await db.transaction(async (trx) => {
      // Verify current ownership
      const assignment = await trx('lead_assignments').where({ lead_id: leadId, counselor_id: req.user.id }).first();
      if (!assignment) {
        throw new Error('You do not own this lead.');
      }

      // Check if there is already a pending transfer request
      const existing = await trx('transfer_requests').where({ lead_id: leadId, status: 'pending' }).first();
      if (existing) {
        throw new Error('A transfer request is already pending for this lead.');
      }

      // Create request
      const reqId = randomUUID();
      await trx('transfer_requests').insert({
        id: reqId,
        lead_id: leadId,
        requested_by: req.user.id,
        request_type: requestType,
        reason,
        note: note || null,
        target_counselor_id: targetCounselorId || null,
        status: 'pending',
        created_at: new Date()
      });

      await logActivity(trx, leadId, req.user.id, 'transfer_request', `Requested transfer (${requestType}). Reason: ${reason}`);
    });

    res.json({ message: 'Transfer request submitted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to submit transfer request' });
  }
});

// Team Leader Transfer Queue (now managed by Manager Operations)
app.get('/api/transfers/queue', authenticateToken, requireRole(['manager', 'super_admin', 'team_leader']), async (req, res) => {
  try {
    let query = db('transfer_requests')
      .join('leads', 'transfer_requests.lead_id', 'leads.id')
      .join('users as requesters', 'transfer_requests.requested_by', 'requesters.id')
      .leftJoin('users as targets', 'transfer_requests.target_counselor_id', 'targets.id')
      .where({ 'transfer_requests.status': 'pending' })
      .select(
        'transfer_requests.*',
        'leads.name as lead_name',
        'requesters.name as requester_name',
        'requesters.team_id as requester_team_id',
        'targets.name as target_name'
      );

    if (req.user.role === 'team_leader') {
      if (!req.user.team_id) {
        return res.json([]);
      }
      query = query.where({ 'requesters.team_id': req.user.team_id });
    }

    const requests = await query;
    const now = new Date();

    const formattedRequests = requests.map(r => {
      const createdTime = new Date(r.created_at);
      const hoursPending = Math.abs(now - createdTime) / 36e5;
      const isEscalated = hoursPending >= 24;

      return {
        ...r,
        hours_pending: hoursPending.toFixed(1),
        is_escalated: isEscalated
      };
    });

    res.json(formattedRequests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch transfer queue' });
  }
});

// Resolve Transfer Request (Approve/Reject)
app.post('/api/transfers/resolve/:id', authenticateToken, requireRole(['manager', 'super_admin', 'team_leader']), async (req, res) => {
  const requestId = req.params.id;
  const { outcome, note, overrideTargetCounselorId } = req.body; // outcome: 'approved', 'rejected'

  if (!outcome || !['approved', 'rejected'].includes(outcome)) {
    return res.status(400).json({ error: 'Valid outcome is required' });
  }

  try {
    if (req.user.role === 'team_leader') {
      const requestUser = await db('transfer_requests')
        .join('users', 'transfer_requests.requested_by', 'users.id')
        .where('transfer_requests.id', requestId)
        .select('users.team_id')
        .first();
      if (!requestUser || requestUser.team_id !== req.user.team_id) {
        return res.status(403).json({ error: 'Access denied: Transfer request belongs to another team.' });
      }
    }

    await db.transaction(async (trx) => {
      const request = await trx('transfer_requests').where({ id: requestId }).first();
      if (!request) {
        throw new Error('Transfer request not found.');
      }

      if (request.status !== 'pending') {
        throw new Error('This request has already been resolved.');
      }

      // Perform update
      await trx('transfer_requests').where({ id: requestId }).update({
        status: outcome,
        reviewed_by: req.user.id,
        reviewed_at: new Date(),
        note: note || request.note
      });

      if (outcome === 'approved') {
        const finalTarget = overrideTargetCounselorId || request.target_counselor_id;
        if (!finalTarget) {
          throw new Error('Target Counselor ID is required to approve the transfer.');
        }

        // Fetch current assignment to identify old owner
        const currentAssign = await trx('lead_assignments').where({ lead_id: request.lead_id }).first();
        const oldOwnerId = currentAssign ? currentAssign.counselor_id : null;

        // Delete old assignment
        await trx('lead_assignments').where({ lead_id: request.lead_id }).delete();

        // Insert new assignment
        await trx('lead_assignments').insert({
          id: randomUUID(),
          lead_id: request.lead_id,
          counselor_id: finalTarget,
          assigned_by: req.user.id,
          assigned_at: new Date(),
          stage: 'L1',
          locked: true,
          updated_at: new Date()
        });

        // Log resolution
        await logActivity(trx, request.lead_id, finalTarget, 'transfer_approve', `Transfer request approved by ${req.user.name}. Owner reassigned.`);
      } else {
        await logActivity(trx, request.lead_id, request.requested_by, 'transfer_reject', `Transfer request rejected by ${req.user.name}.`);
      }
    });

    res.json({ message: `Transfer request successfully ${outcome}.` });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to resolve transfer request' });
  }
});


// --- MASTER LEAD REPOSITORY ---

app.get('/api/leads/master', authenticateToken, requireRole(['super_admin', 'manager', 'team_leader']), async (req, res) => {
  const { batch_id, stage, status, source } = req.query;

  try {
    let query = db('leads')
      .leftJoin('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .leftJoin('users as counselors', 'lead_assignments.counselor_id', 'counselors.id')
      .leftJoin('universities', 'leads.university_id', 'universities.id');

    if (req.user.role === 'team_leader') {
      if (!req.user.team_id) {
        return res.json([]);
      }
      query = query.where({ 'counselors.team_id': req.user.team_id });
    }

    query = query.select(
        'leads.*',
        'lead_assignments.stage',
        'lead_assignments.locked',
        'counselors.name as counselor_name',
        'universities.name as university_name'
      );

    if (batch_id) {
      query = query.where({ 'leads.upload_batch_id': batch_id });
    }

    if (stage) {
      query = query.where({ 'lead_assignments.stage': stage });
    }

    if (status) {
      query = query.where({ 'leads.status': status });
    }

    if (source) {
      query = query.where({ 'leads.source': source });
    }

    const leads = await query.orderBy('leads.created_at', 'desc');
    res.json(leads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch master leads repository' });
  }
});

// Get lead detail timeline
app.get('/api/leads/:id/timeline', authenticateToken, requireRole(['super_admin', 'manager', 'team_leader']), async (req, res) => {
  const leadId = req.params.id;

  try {
    if (req.user.role === 'team_leader') {
      const assigned = await db('lead_assignments')
        .join('users', 'lead_assignments.counselor_id', 'users.id')
        .where({ 'lead_assignments.lead_id': leadId, 'users.team_id': req.user.team_id })
        .first();
      if (!assigned) {
        return res.status(403).json({ error: 'Access denied: Lead is not assigned to your team.' });
      }
    }
    const logs = await db('lead_activity_log')
      .leftJoin('users', 'lead_activity_log.counselor_id', 'users.id')
      .where({ lead_id: leadId })
      .select('lead_activity_log.*', 'users.name as user_name', 'users.role as user_role')
      .orderBy('lead_activity_log.timestamp', 'desc');

    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch timeline logs' });
  }
});


// --- REPORTS & PIPELINE METRICS ---

app.get('/api/reports/pipeline', authenticateToken, requireRole(['super_admin', 'manager', 'team_leader']), async (req, res) => {
  try {
    let stagesQuery = db('lead_assignments');
    let closuresQuery = db('closures');

    if (req.user.role === 'team_leader') {
      if (!req.user.team_id) {
        return res.json({ stages: [], closures: [], unassigned: 0 });
      }
      stagesQuery = stagesQuery
        .join('users', 'lead_assignments.counselor_id', 'users.id')
        .where({ 'users.team_id': req.user.team_id });
      closuresQuery = closuresQuery
        .whereIn('closures.counselor_id', db('users').where({ team_id: req.user.team_id }).select('id'));
    }

    // 1. Stages counts
    const stagesCounts = await stagesQuery
      .groupBy('lead_assignments.stage')
      .select('lead_assignments.stage')
      .count('lead_assignments.id as count');

    // 2. Closure counts (enrolled vs lost)
    const closureCounts = await closuresQuery
      .groupBy('closures.final_status')
      .select('closures.final_status')
      .count('closures.id as count')
      .sum('closures.revenue as total_revenue');

    // 3. Unassigned counts
    const unassignedCount = req.user.role === 'team_leader' ? { count: 0 } : await db('leads')
      .leftJoin('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .where({ 'leads.status': 'clean' })
      .whereNull('lead_assignments.id')
      .count('leads.id as count')
      .first();

    res.json({
      stages: stagesCounts,
      closures: closureCounts,
      unassigned: parseInt(unassignedCount.count || 0, 10)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Counselor Leaderboard — enrolled, lost, active leads per counselor
app.get('/api/reports/counselor-leaderboard', authenticateToken, requireRole(['super_admin', 'manager', 'team_leader']), async (req, res) => {
  try {
    let activeQuery = db('lead_assignments')
      .join('users', 'lead_assignments.counselor_id', 'users.id')
      .groupBy('lead_assignments.counselor_id', 'users.name', 'lead_assignments.stage')
      .select('lead_assignments.counselor_id', 'users.name as counselor_name', 'lead_assignments.stage')
      .count('lead_assignments.id as cnt');

    let closuresQuery = db('lead_activity_log')
      .join('closures', 'lead_activity_log.lead_id', 'closures.lead_id')
      .join('users', 'lead_activity_log.counselor_id', 'users.id')
      .where({ 'lead_activity_log.action': 'tick' })
      .groupBy('lead_activity_log.counselor_id', 'users.name', 'closures.final_status')
      .select('lead_activity_log.counselor_id', 'users.name as counselor_name', 'closures.final_status')
      .count('closures.id as cnt')
      .sum('closures.revenue as total_revenue');

    if (req.user.role === 'team_leader') {
      if (!req.user.team_id) {
        return res.json([]);
      }
      activeQuery = activeQuery.where({ 'users.team_id': req.user.team_id });
      closuresQuery = closuresQuery.where({ 'users.team_id': req.user.team_id });
    }

    // Active leads per counselor per stage
    const activeLeads = await activeQuery;

    // Closures per counselor
    const closures = await closuresQuery;

    // Merge
    const counselorMap = {};

    activeLeads.forEach(r => {
      if (!counselorMap[r.counselor_id]) {
        counselorMap[r.counselor_id] = { id: r.counselor_id, name: r.counselor_name, L1: 0, L2: 0, L3: 0, enrolled: 0, lost: 0, revenue: 0 };
      }
      counselorMap[r.counselor_id][r.stage] = parseInt(r.cnt, 10);
    });

    closures.forEach(c => {
      if (!counselorMap[c.counselor_id]) {
        counselorMap[c.counselor_id] = { id: c.counselor_id, name: c.counselor_name, L1: 0, L2: 0, L3: 0, enrolled: 0, lost: 0, revenue: 0 };
      }
      counselorMap[c.counselor_id][c.final_status] = parseInt(c.cnt, 10);
      if (c.final_status === 'enrolled') {
        counselorMap[c.counselor_id].revenue = parseFloat(c.total_revenue || 0);
      }
    });

    const result = Object.values(counselorMap).sort((a, b) => b.enrolled - a.enrolled);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch counselor leaderboard' });
  }
});

// Lead source breakdown
app.get('/api/reports/source-breakdown', authenticateToken, requireRole(['super_admin', 'manager', 'team_leader']), async (req, res) => {
  try {
    let query = db('leads')
      .where({ 'leads.status': 'clean' })
      .groupBy('leads.source')
      .select('leads.source')
      .count('leads.id as count')
      .orderBy('count', 'desc');

    if (req.user.role === 'team_leader') {
      if (!req.user.team_id) {
        return res.json([]);
      }
      query = query
        .join('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
        .join('users as counselors', 'lead_assignments.counselor_id', 'counselors.id')
        .where({ 'counselors.team_id': req.user.team_id });
    }

    const sources = await query;
    res.json(sources);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch source breakdown' });
  }
});

// Daily upload trend (last 14 days)
app.get('/api/reports/upload-trend', authenticateToken, requireRole(['super_admin', 'manager', 'team_leader']), async (req, res) => {
  try {
    const trend = await db('upload_batches')
      .whereRaw(`upload_date >= date('now', '-14 days')`)
      .groupByRaw(`date(upload_date)`)
      .select(db.raw(`date(upload_date) as date, SUM(total_rows) as total, SUM(clean_rows) as clean`))
      .orderBy('date', 'asc');
    res.json(trend);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch upload trend' });
  }
});

// GET /api/reports/custom-timeline — summary of upload batches, distributed leads, and conversions in a date range
app.get('/api/reports/custom-timeline', authenticateToken, requireRole(['super_admin', 'manager', 'team_leader']), async (req, res) => {
  const { start_date, end_date } = req.query;
  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'start_date and end_date are required' });
  }

  const start = new Date(`${start_date}T00:00:00.000Z`);
  const end = new Date(`${end_date}T23:59:59.999Z`);

  try {
    // 1. Batches uploaded in this range
    let batches = [];
    if (req.user.role !== 'team_leader') {
      batches = await db('upload_batches')
        .leftJoin('users', 'upload_batches.uploaded_by', 'users.id')
        .where('upload_batches.upload_date', '>=', start)
        .where('upload_batches.upload_date', '<=', end)
        .select('upload_batches.*', 'users.name as uploader_name')
        .orderBy('upload_batches.upload_date', 'desc');
    }

    // 2. Summary stats for leads created in this range
    let leadsSummaryQuery = db('leads')
      .where('leads.created_at', '>=', start)
      .where('leads.created_at', '<=', end);
    if (req.user.role === 'team_leader') {
      if (!req.user.team_id) {
        return res.json({
          summary: { total_uploaded: 0, clean_rows: 0, duplicate_rows: 0, invalid_rows: 0, total_distributed: 0, enrolled: 0, lost: 0, revenue: 0 },
          batches: [],
          counselors: []
        });
      }
      leadsSummaryQuery = leadsSummaryQuery
        .join('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
        .join('users as counselors', 'lead_assignments.counselor_id', 'counselors.id')
        .where({ 'counselors.team_id': req.user.team_id });
    }

    const leadsSummary = await leadsSummaryQuery
      .select('leads.status')
      .count('leads.id as count')
      .groupBy('leads.status');

    let totalUploaded = 0;
    let cleanRows = 0;
    let duplicateRows = 0;
    let invalidRows = 0;
    leadsSummary.forEach(s => {
      const count = parseInt(s.count || 0, 10);
      totalUploaded += count;
      if (s.status === 'clean') cleanRows = count;
      else if (s.status === 'duplicate') duplicateRows = count;
      else if (s.status === 'invalid') invalidRows = count;
    });

    // 3. Distribution & Assignment stats in this range
    let distQuery = db('lead_assignments')
      .where('lead_assignments.assigned_at', '>=', start)
      .where('lead_assignments.assigned_at', '<=', end);
    if (req.user.role === 'team_leader') {
      distQuery = distQuery
        .join('users as counselors', 'lead_assignments.counselor_id', 'counselors.id')
        .where({ 'counselors.team_id': req.user.team_id });
    }

    const distributedCount = await distQuery
      .count('lead_assignments.id as count')
      .first();

    // 4. Closures summary in this range
    let closuresSumQuery = db('closures')
      .where('closures.closed_at', '>=', start)
      .where('closures.closed_at', '<=', end);
    if (req.user.role === 'team_leader') {
      closuresSumQuery = closuresSumQuery
        .whereIn('closures.counselor_id', db('users').where({ team_id: req.user.team_id }).select('id'));
    }

    const closuresSummary = await closuresSumQuery
      .select('closures.final_status')
      .count('closures.id as count')
      .sum('closures.revenue as total_revenue')
      .groupBy('closures.final_status');

    let enrolledCount = 0;
    let lostCount = 0;
    let totalRevenue = 0;
    closuresSummary.forEach(c => {
      const count = parseInt(c.count || 0, 10);
      if (c.final_status === 'enrolled') {
        enrolledCount = count;
        totalRevenue = parseFloat(c.total_revenue || 0);
      } else if (c.final_status === 'lost') {
        lostCount = count;
      }
    });

    // 5. Counselor-wise allocation and conversions in this range
    let counselorAllocationsQuery = db('lead_assignments')
      .join('users', 'lead_assignments.counselor_id', 'users.id')
      .where('lead_assignments.assigned_at', '>=', start)
      .where('lead_assignments.assigned_at', '<=', end);

    let counselorClosuresQuery = db('lead_activity_log')
      .join('closures', 'lead_activity_log.lead_id', 'closures.lead_id')
      .join('users', 'lead_activity_log.counselor_id', 'users.id')
      .where({ 'lead_activity_log.action': 'tick' })
      .where('closures.closed_at', '>=', start)
      .where('closures.closed_at', '<=', end);

    if (req.user.role === 'team_leader') {
      counselorAllocationsQuery = counselorAllocationsQuery.where({ 'users.team_id': req.user.team_id });
      counselorClosuresQuery = counselorClosuresQuery.where({ 'users.team_id': req.user.team_id });
    }

    const counselorAllocations = await counselorAllocationsQuery
      .groupBy('lead_assignments.counselor_id', 'users.name', 'lead_assignments.stage')
      .select('lead_assignments.counselor_id', 'users.name as counselor_name', 'lead_assignments.stage')
      .count('lead_assignments.id as cnt');

    const counselorClosures = await counselorClosuresQuery
      .groupBy('lead_activity_log.counselor_id', 'users.name', 'closures.final_status')
      .select('lead_activity_log.counselor_id', 'users.name as counselor_name', 'closures.final_status')
      .count('closures.id as cnt')
      .sum('closures.revenue as total_revenue');

    const counselorMap = {};
    counselorAllocations.forEach(r => {
      if (!counselorMap[r.counselor_id]) {
        counselorMap[r.counselor_id] = { id: r.counselor_id, name: r.counselor_name, L1: 0, L2: 0, L3: 0, enrolled: 0, lost: 0, revenue: 0 };
      }
      counselorMap[r.counselor_id][r.stage] = parseInt(r.cnt, 10);
    });

    counselorClosures.forEach(c => {
      if (!counselorMap[c.counselor_id]) {
        counselorMap[c.counselor_id] = { id: c.counselor_id, name: c.counselor_name, L1: 0, L2: 0, L3: 0, enrolled: 0, lost: 0, revenue: 0 };
      }
      counselorMap[c.counselor_id][c.final_status] = parseInt(c.cnt, 10);
      if (c.final_status === 'enrolled') {
        counselorMap[c.counselor_id].revenue = parseFloat(c.total_revenue || 0);
      }
    });

    res.json({
      summary: {
        total_uploaded: totalUploaded,
        clean_rows: cleanRows,
        duplicate_rows: duplicateRows,
        invalid_rows: invalidRows,
        total_distributed: parseInt(distributedCount.count || 0, 10),
        enrolled: enrolledCount,
        lost: lostCount,
        revenue: totalRevenue
      },
      batches,
      counselors: Object.values(counselorMap)
    });

  } catch (err) {
    console.error('Custom timeline summary error:', err);
    res.status(500).json({ error: 'Failed to fetch custom timeline summary' });
  }
});

// GET /api/reports/custom-timeline/leads — detailed list of students/leads created in a date range
app.get('/api/reports/custom-timeline/leads', authenticateToken, requireRole(['super_admin', 'manager', 'team_leader']), async (req, res) => {
  const { start_date, end_date, search } = req.query;
  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'start_date and end_date are required' });
  }

  const start = new Date(`${start_date}T00:00:00.000Z`);
  const end = new Date(`${end_date}T23:59:59.999Z`);

  try {
    let query = db('leads')
      .leftJoin('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .leftJoin('users as counselors', 'lead_assignments.counselor_id', 'counselors.id')
      .leftJoin('closures', 'leads.id', 'closures.lead_id')
      .leftJoin('universities', 'leads.university_id', 'universities.id')
      .leftJoin('upload_batches', 'leads.upload_batch_id', 'upload_batches.id')
      .where('leads.created_at', '>=', start)
      .where('leads.created_at', '<=', end);

    if (req.user.role === 'team_leader') {
      if (!req.user.team_id) {
        return res.json([]);
      }
      query = query.where({ 'counselors.team_id': req.user.team_id });
    }

    query = query.select(
        'leads.*',
        'upload_batches.file_name as batch_name',
        'lead_assignments.stage',
        'lead_assignments.disposition',
        'counselors.name as counselor_name',
        'closures.final_status as closure_status',
        'closures.revenue as closure_revenue',
        'universities.name as university_name'
      );

    if (search) {
      const q = `%${search.toLowerCase()}%`;
      query = query.where(function() {
        this.where(db.raw('LOWER(leads.name)'), 'like', q)
            .orWhere(db.raw('LOWER(leads.phone)'), 'like', q)
            .orWhere(db.raw('LOWER(leads.email)'), 'like', q);
      });
    }

    const leads = await query.orderBy('leads.created_at', 'desc');
    res.json(leads);
  } catch (err) {
    console.error('Custom timeline leads error:', err);
    res.status(500).json({ error: 'Failed to fetch custom timeline leads' });
  }
});

// GET /api/reports/custom-timeline/export — export detailed leads report for a custom date range to Excel
app.get('/api/reports/custom-timeline/export', authenticateToken, requireRole(['super_admin', 'manager']), async (req, res) => {
  const { start_date, end_date } = req.query;
  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'start_date and end_date are required' });
  }

  const start = new Date(`${start_date}T00:00:00.000Z`);
  const end = new Date(`${end_date}T23:59:59.999Z`);

  try {
    const leads = await db('leads')
      .leftJoin('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .leftJoin('users as counselors', 'lead_assignments.counselor_id', 'counselors.id')
      .leftJoin('closures', 'leads.id', 'closures.lead_id')
      .leftJoin('universities', 'leads.university_id', 'universities.id')
      .leftJoin('upload_batches', 'leads.upload_batch_id', 'upload_batches.id')
      .where('leads.created_at', '>=', start)
      .where('leads.created_at', '<=', end)
      .select(
        'leads.name as Candidate Name',
        'leads.phone as Phone',
        'leads.email as Email',
        'leads.city as City',
        'leads.state as State',
        'leads.experience as Experience (Yrs)',
        'leads.current_company as Current Company',
        'leads.salary as Salary/CTC',
        'leads.graduation as Graduation/Degree',
        'leads.course_interest as Course Interest',
        'universities.name as Interested University',
        'leads.source as Lead Source',
        'upload_batches.file_name as Upload Batch',
        'counselors.name as Assigned Counselor',
        'lead_assignments.stage as Pipeline Stage',
        'leads.status as Data Status',
        'closures.final_status as Closure Outcome',
        'closures.revenue as Revenue',
        'leads.created_at as Upload Date'
      )
      .orderBy('leads.created_at', 'asc');

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(leads);
    xlsx.utils.book_append_sheet(wb, ws, "Leads Timeline Report");
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', `attachment; filename="timeline_report_${start_date}_to_${end_date}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error('Custom timeline export error:', err);
    res.status(500).json({ error: 'Failed to export custom timeline leads report' });
  }
});

// Master database logging endpoint for exports
app.post('/api/audit/log-export', authenticateToken, requireRole(['super_admin']), async (req, res) => {
  const { rowCount, reason } = req.body;

  try {
    await db('lead_activity_log').insert({
      id: randomUUID(),
      action: 'export',
      counselor_id: req.user.id,
      remark: `Exported ${rowCount} rows. Reason: ${reason || 'Unspecified'}`,
      timestamp: new Date()
    });
    res.json({ message: 'Export logged successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to log export audit trail' });
  }
});

// Audit trail logs
app.get('/api/audit/logs', authenticateToken, requireRole(['super_admin']), async (req, res) => {
  const { user_id, action_type, start_date } = req.query;

  try {
    let query = db('lead_activity_log')
      .leftJoin('users', 'lead_activity_log.counselor_id', 'users.id')
      .leftJoin('leads', 'lead_activity_log.lead_id', 'leads.id')
      .select(
        'lead_activity_log.*',
        'users.name as user_name',
        'users.company_email as user_email',
        'leads.name as lead_name'
      );

    if (user_id) {
      query = query.where({ 'lead_activity_log.counselor_id': user_id });
    }

    if (action_type) {
      query = query.where({ 'lead_activity_log.action': action_type });
    }

    if (start_date) {
      query = query.where('lead_activity_log.timestamp', '>=', new Date(start_date));
    }

    const logs = await query.orderBy('lead_activity_log.timestamp', 'desc').limit(200);
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// --- DATA VAULT ---

// GET /api/vault/batches — all upload batches with enriched pipeline + conversion stats
app.get('/api/vault/batches', authenticateToken, requireRole(['super_admin', 'manager']), async (req, res) => {
  const { date } = req.query;

  try {
    let batchQuery = db('upload_batches')
      .leftJoin('users', 'upload_batches.uploaded_by', 'users.id')
      .select(
        'upload_batches.*',
        'users.name as uploader_name'
      )
      .orderBy('upload_batches.upload_date', 'desc');

    if (date) {
      // Filter by calendar day (date = YYYY-MM-DD)
      batchQuery = batchQuery.whereRaw(
        `DATE(upload_batches.upload_date) = ?`,
        [date]
      );
    }

    const batches = await batchQuery;

    if (batches.length === 0) {
      return res.json([]);
    }

    const batchIds = batches.map(b => b.id);

    // Stage counts per batch (L1/L2/L3) — join leads → lead_assignments
    const stageCounts = await db('leads')
      .join('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .whereIn('leads.upload_batch_id', batchIds)
      .groupBy('leads.upload_batch_id', 'lead_assignments.stage')
      .select('leads.upload_batch_id as batch_id', 'lead_assignments.stage')
      .count('lead_assignments.id as cnt');

    // Conversion summary per batch — enrolled / lost / revenue
    const conversionData = await db('leads')
      .join('closures', 'leads.id', 'closures.lead_id')
      .whereIn('leads.upload_batch_id', batchIds)
      .groupBy('leads.upload_batch_id', 'closures.final_status')
      .select('leads.upload_batch_id as batch_id', 'closures.final_status')
      .count('closures.id as cnt')
      .sum('closures.revenue as total_revenue');

    // Distribution count per batch
    const distCounts = await db('distribution_batches')
      .whereIn('source_batch_id', batchIds)
      .groupBy('source_batch_id')
      .select('source_batch_id as batch_id')
      .count('id as dist_count');

    // Unassigned clean count per batch
    const unassignedCounts = await db('leads')
      .leftJoin('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .whereIn('leads.upload_batch_id', batchIds)
      .where({ 'leads.status': 'clean' })
      .whereNull('lead_assignments.id')
      .groupBy('leads.upload_batch_id')
      .select('leads.upload_batch_id as batch_id')
      .count('leads.id as cnt');

    // Build lookup maps
    const stageMap = {};
    stageCounts.forEach(s => {
      if (!stageMap[s.batch_id]) stageMap[s.batch_id] = { L1: 0, L2: 0, L3: 0 };
      stageMap[s.batch_id][s.stage] = parseInt(s.cnt, 10);
    });

    const convMap = {};
    conversionData.forEach(c => {
      if (!convMap[c.batch_id]) convMap[c.batch_id] = { enrolled: 0, lost: 0, revenue: 0 };
      convMap[c.batch_id][c.final_status] = parseInt(c.cnt, 10);
      if (c.final_status === 'enrolled') {
        convMap[c.batch_id].revenue = parseFloat(c.total_revenue || 0);
      }
    });

    const distMap = {};
    distCounts.forEach(d => {
      distMap[d.batch_id] = parseInt(d.dist_count, 10);
    });

    const unassignedMap = {};
    unassignedCounts.forEach(u => {
      unassignedMap[u.batch_id] = parseInt(u.cnt, 10);
    });

    // Merge into enriched response
    const enriched = batches.map(b => {
      const remainingClean = unassignedMap[b.id] !== undefined ? unassignedMap[b.id] : b.clean_rows;
      const distributedClean = Math.max(0, b.clean_rows - remainingClean);
      return {
        ...b,
        stages: stageMap[b.id] || { L1: 0, L2: 0, L3: 0 },
        conversions: convMap[b.id] || { enrolled: 0, lost: 0, revenue: 0 },
        distribution_count: distMap[b.id] || 0,
        remaining_clean_count: remainingClean,
        distributed_clean_count: distributedClean
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch vault batches' });
  }
});

// GET /api/vault/batches/:id — deep detail: distribution → per-counselor breakdown
app.get('/api/vault/batches/:id', authenticateToken, requireRole(['super_admin', 'manager']), async (req, res) => {
  const batchId = req.params.id;

  try {
    // Batch header
    const batch = await db('upload_batches')
      .leftJoin('users', 'upload_batches.uploaded_by', 'users.id')
      .where({ 'upload_batches.id': batchId })
      .select('upload_batches.*', 'users.name as uploader_name')
      .first();

    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // All distribution batches linked to this upload batch
    const distBatches = await db('distribution_batches')
      .leftJoin('users as distributors', 'distribution_batches.distributed_by', 'distributors.id')
      .where({ 'distribution_batches.source_batch_id': batchId })
      .select('distribution_batches.*', 'distributors.name as distributor_name')
      .orderBy('distribution_batches.distributed_at', 'desc');

    // For each distribution batch: per-counselor allocations
    const distBatchIds = distBatches.map(d => d.id);

    let counselorAllocations = [];
    if (distBatchIds.length > 0) {
      counselorAllocations = await db('distribution_allocations')
        .join('users as counselors', 'distribution_allocations.counselor_id', 'counselors.id')
        .whereIn('distribution_allocations.distribution_batch_id', distBatchIds)
        .select(
          'distribution_allocations.*',
          'counselors.name as counselor_name',
          'counselors.company_email as counselor_email'
        );
    }

    // For each counselor allocation: get stage counts and conversions for their leads in THIS batch
    const counselorIds = [...new Set(counselorAllocations.map(a => a.counselor_id))];

    let counselorStages = [];
    let counselorConversions = [];

    if (counselorIds.length > 0) {
      // Stage breakdown per counselor for leads from this batch
      counselorStages = await db('leads')
        .join('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
        .where({ 'leads.upload_batch_id': batchId })
        .whereIn('lead_assignments.counselor_id', counselorIds)
        .groupBy('lead_assignments.counselor_id', 'lead_assignments.stage')
        .select('lead_assignments.counselor_id', 'lead_assignments.stage')
        .count('lead_assignments.id as cnt');

      // Conversion breakdown per counselor for leads from this batch
      counselorConversions = await db('leads')
        .join('closures', 'leads.id', 'closures.lead_id')
        .join('lead_activity_log', function() {
          this.on('lead_activity_log.lead_id', '=', 'leads.id')
              .andOn('lead_activity_log.action', db.raw("'tick'"));
        })
        .where({ 'leads.upload_batch_id': batchId })
        .whereIn('lead_activity_log.counselor_id', counselorIds)
        .groupBy('lead_activity_log.counselor_id', 'closures.final_status')
        .select('lead_activity_log.counselor_id', 'closures.final_status')
        .count('closures.id as cnt')
        .sum('closures.revenue as total_revenue');
    }

    // Build stage map per counselor
    const counselorStageMap = {};
    counselorStages.forEach(s => {
      if (!counselorStageMap[s.counselor_id]) counselorStageMap[s.counselor_id] = { L1: 0, L2: 0, L3: 0 };
      counselorStageMap[s.counselor_id][s.stage] = parseInt(s.cnt, 10);
    });

    const counselorConvMap = {};
    counselorConversions.forEach(c => {
      if (!counselorConvMap[c.counselor_id]) counselorConvMap[c.counselor_id] = { enrolled: 0, lost: 0, revenue: 0 };
      counselorConvMap[c.counselor_id][c.final_status] = parseInt(c.cnt, 10);
      if (c.final_status === 'enrolled') {
        counselorConvMap[c.counselor_id].revenue = parseFloat(c.total_revenue || 0);
      }
    });

    // Merge into allocation records
    const enrichedAllocations = counselorAllocations.map(a => ({
      ...a,
      actual_lead_ids: undefined, // strip heavy field
      stages: counselorStageMap[a.counselor_id] || { L1: 0, L2: 0, L3: 0 },
      conversions: counselorConvMap[a.counselor_id] || { enrolled: 0, lost: 0, revenue: 0 }
    }));

    // Group allocations by distribution batch
    const distBatchesEnriched = distBatches.map(db_row => ({
      ...db_row,
      allocations: enrichedAllocations.filter(a => a.distribution_batch_id === db_row.id)
    }));

    res.json({
      batch,
      distributions: distBatchesEnriched
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch batch vault detail' });
  }
});

// DELETE /api/vault/batches/:id — delete a batch and its associated leads
app.delete('/api/vault/batches/:id', authenticateToken, requireRole(['super_admin', 'manager']), async (req, res) => {
  const batchId = req.params.id;
  try {
    const batch = await db('upload_batches').where({ id: batchId }).first();
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    await db.transaction(async (trx) => {
      // Get all lead IDs for this batch
      const leads = await trx('leads').where({ upload_batch_id: batchId }).select('id');
      const leadIds = leads.map(l => l.id);

      if (leadIds.length > 0) {
        // 1. Delete all dependent child records first
        await trx('lead_assignments').whereIn('lead_id', leadIds).delete();
        await trx('lead_activity_log').whereIn('lead_id', leadIds).delete();
        await trx('follow_ups').whereIn('lead_id', leadIds).delete();
        await trx('closures').whereIn('lead_id', leadIds).delete();
        await trx('transfer_requests').whereIn('lead_id', leadIds).delete();

        // 2. Delete the leads themselves
        await trx('leads').whereIn('id', leadIds).delete();
      }

      // 3. Delete the batch itself
      await trx('upload_batches').where({ id: batchId }).delete();

      // 4. Log this action in system activity log
      await trx('lead_activity_log').insert({
        id: randomUUID(),
        lead_id: null,
        counselor_id: req.user.id,
        action: 'note',
        remark: `Deleted upload batch: ${batch.file_name} (Total rows: ${batch.total_rows})`,
        timestamp: new Date()
      });
    });

    res.json({ message: 'Upload batch and associated leads deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete upload batch' });
  }
});

// GET /api/vault/batches/:id/conversions — list of enrolled or lost leads from a batch
app.get('/api/vault/batches/:id/conversions', authenticateToken, requireRole(['super_admin', 'manager']), async (req, res) => {
  const { id } = req.params;
  const { status } = req.query; // 'enrolled' or 'lost'
  
  if (!status || (status !== 'enrolled' && status !== 'lost')) {
    return res.status(400).json({ error: "Query parameter 'status' must be 'enrolled' or 'lost'" });
  }
  
  try {
    const leads = await db('leads')
      .join('closures', 'leads.id', 'closures.lead_id')
      .leftJoin('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .leftJoin('users as counselors', 'lead_assignments.counselor_id', 'counselors.id')
      .leftJoin('universities', 'closures.university_id', 'universities.id')
      .where({ 'leads.upload_batch_id': id, 'closures.final_status': status })
      .select(
        'leads.*',
        'counselors.name as counselor_name',
        'counselors.company_email as counselor_email',
        'closures.revenue',
        'closures.closed_at',
        'universities.name as university_name'
      )
      .orderBy('leads.name', 'asc');
      
    res.json(leads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch conversion leads details' });
  }
});

// GET /api/vault/batches/:batchId/counselors/:counselorId/leads — list of leads assigned to a counselor from a batch
app.get('/api/vault/batches/:batchId/counselors/:counselorId/leads', authenticateToken, requireRole(['super_admin', 'manager']), async (req, res) => {
  const { batchId, counselorId } = req.params;
  try {
    const leads = await db('leads')
      .join('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .leftJoin('universities', 'leads.university_id', 'universities.id')
      .where({ 'leads.upload_batch_id': batchId, 'lead_assignments.counselor_id': counselorId })
      .select('leads.*', 'lead_assignments.stage', 'lead_assignments.disposition', 'lead_assignments.updated_at as assigned_updated_at', 'universities.name as university_name')
      .orderBy('leads.name', 'asc');
    res.json(leads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch counselor batch leads' });
  }
});

// GET /api/manager/leads/dropped - all dropped leads across system
app.get('/api/manager/leads/dropped', authenticateToken, requireRole(['super_admin', 'manager', 'team_leader']), async (req, res) => {
  try {
    let query = db('leads')
      .join('closures', 'leads.id', 'closures.lead_id')
      .leftJoin('users', 'closures.counselor_id', 'users.id')
      .leftJoin('universities', 'closures.university_id', 'universities.id')
      .where({ 'closures.final_status': 'lost' });

    if (req.user.role === 'team_leader') {
      if (!req.user.team_id) {
        return res.json([]);
      }
      query = query.where({ 'users.team_id': req.user.team_id });
    }

    const droppedLeads = await query
      .select(
        'leads.*',
        'closures.drop_stage',
        'closures.drop_remark',
        'closures.closed_at',
        'users.name as counselor_name',
        'universities.name as university_name'
      )
      .orderBy('closures.closed_at', 'desc');

    res.json(droppedLeads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch manager dropped leads' });
  }
});

// GET /api/manager/leads/decompositions - get full stage decompositions and journey mapping
app.get('/api/manager/leads/decompositions', authenticateToken, requireRole(['super_admin', 'manager', 'team_leader']), async (req, res) => {
  const { startDate, endDate } = req.query;

  try {
    // 1. Convert inputs to timestamps or defaults
    const start = startDate ? new Date(startDate).getTime() : 0;
    const end = endDate ? new Date(endDate).getTime() : Date.now();

    // 2. Fetch all activity logs in the range, joined with users
    let logQuery = db('lead_activity_log')
      .join('users', 'lead_activity_log.counselor_id', 'users.id')
      .whereBetween('lead_activity_log.timestamp', [start, end])
      .whereNotNull('lead_activity_log.lead_id');

    // If Team Leader, filter activity logs by team counselors
    if (req.user.role === 'team_leader') {
      if (!req.user.team_id) {
        return res.json([]);
      }
      logQuery = logQuery.where({ 'users.team_id': req.user.team_id });
    }

    const logs = await logQuery.select(
      'lead_activity_log.*',
      'users.name as counselor_name'
    ).orderBy('lead_activity_log.timestamp', 'asc');

    if (logs.length === 0) {
      return res.json([]);
    }

    // Group logs by lead_id
    const leadIds = Array.from(new Set(logs.map(log => log.lead_id)));

    // 3. Fetch corresponding leads and their closures
    const leads = await db('leads')
      .leftJoin('closures', 'leads.id', 'closures.lead_id')
      .leftJoin('universities', 'closures.university_id', 'universities.id')
      .whereIn('leads.id', leadIds)
      .select(
        'leads.*',
        'closures.revenue as closure_revenue',
        'closures.documents_status as documents_status',
        'closures.closed_at',
        'closures.final_status',
        'closures.drop_stage',
        'closures.drop_remark',
        'universities.name as university_name'
      );

    const leadsMap = {};
    leads.forEach(l => {
      leadsMap[l.id] = l;
    });

    // 4. Process journeys chronologically
    const leadJourneys = {};
    logs.forEach(log => {
      const leadId = log.lead_id;
      const lead = leadsMap[leadId];
      if (!lead) return;

      if (!leadJourneys[leadId]) {
        leadJourneys[leadId] = {
          id: lead.id,
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          city: lead.city,
          state: lead.state,
          course_interest: lead.course_interest,
          source: lead.source,
          university_name: lead.university_name,
          closure_revenue: lead.closure_revenue,
          final_status: lead.final_status,
          drop_stage: lead.drop_stage,
          drop_remark: lead.drop_remark,
          documents_status: lead.documents_status,
          l1: null,
          l2: null,
          l3_reg: null,
          l3_docs: null,
          l3_fees: null
        };
      }

      const journey = leadJourneys[leadId];
      const remarkLower = (log.remark || '').toLowerCase();

      // Map activities to journey milestones using flexible matchers
      if (log.action === 'tick' && (remarkLower.includes('qualified') || remarkLower.includes('l2 active'))) {
        journey.l1 = {
          date: log.timestamp,
          counselor: log.counselor_name,
          remark: log.remark
        };
      } else if (log.action === 'tick' && (remarkLower.includes('punched') || remarkLower.includes('advanced to l3'))) {
        journey.l2 = {
          date: log.timestamp,
          counselor: log.counselor_name,
          remark: log.remark
        };
      } else if (remarkLower.includes('registration number') || remarkLower.includes('registered') || remarkLower.includes('registration')) {
        journey.l3_reg = {
          date: log.timestamp,
          counselor: log.counselor_name,
          remark: log.remark
        };
      } else if (remarkLower.includes('verification documents') || remarkLower.includes('documents verified') || remarkLower.includes('checklist')) {
        journey.l3_docs = {
          date: log.timestamp,
          counselor: log.counselor_name,
          remark: log.remark
        };
      } else if (log.action === 'tick' && (remarkLower.includes('successfully closed') || remarkLower.includes('enrolled') || remarkLower.includes('closed deal'))) {
        journey.l3_fees = {
          date: log.timestamp,
          counselor: log.counselor_name,
          remark: log.remark
        };
      } else if (log.action === 'cross' || remarkLower.includes('dropped') || remarkLower.includes('lost')) {
        journey.l3_fees = {
          date: log.timestamp,
          counselor: log.counselor_name,
          remark: 'Lead Dropped/Lost: ' + log.remark
        };
      }
    });

    res.json(Object.values(leadJourneys));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve lead journey decompositions' });
  }
});


// --- LEAD FORWARDING TO MANAGER ---

// POST /api/counselor/leads/:id/forward - Counselor forwards lead to manager
app.post('/api/counselor/leads/:id/forward', authenticateToken, requireRole(['counselor']), async (req, res) => {
  const leadId = req.params.id;
  const { remark } = req.body;

  if (!remark) {
    return res.status(400).json({ error: 'Remark is required to forward lead to manager.' });
  }

  try {
    await db.transaction(async (trx) => {
      // 1. Verify ownership
      const assignment = await trx('lead_assignments').where({ lead_id: leadId, counselor_id: req.user.id }).first();
      if (!assignment) {
        throw new Error('Access denied: You do not own this lead.');
      }

      // 2. Set is_forwarded = true
      await trx('lead_assignments').where({ lead_id: leadId }).update({
        is_forwarded: true,
        forward_remark: remark,
        forwarded_at: new Date(),
        updated_at: new Date()
      });

      // 3. Log activity
      await logActivity(trx, leadId, req.user.id, 'forward_to_manager', `Forwarded to manager. Reason: ${remark}`);
    });

    res.json({ message: 'Lead forwarded to manager successfully.' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to forward lead' });
  }
});

// GET /api/manager/leads/forwarded - get all forwarded leads for managers/super admins
app.get('/api/manager/leads/forwarded', authenticateToken, requireRole(['super_admin', 'manager', 'team_leader']), async (req, res) => {
  try {
    let query = db('lead_assignments')
      .join('leads', 'lead_assignments.lead_id', 'leads.id')
      .join('users', 'lead_assignments.counselor_id', 'users.id')
      .where({ 'lead_assignments.is_forwarded': true });

    if (req.user.role === 'team_leader') {
      if (!req.user.team_id) {
        return res.json([]);
      }
      query = query.where({ 'users.team_id': req.user.team_id });
    }

    const forwardedLeads = await query
      .select(
        'leads.*',
        'lead_assignments.stage',
        'lead_assignments.disposition',
        'lead_assignments.forward_remark',
        'lead_assignments.forwarded_at',
        'users.name as counselor_name',
        'users.id as counselor_id'
      )
      .orderBy('lead_assignments.forwarded_at', 'desc');

    res.json(forwardedLeads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch forwarded leads' });
  }
});

// POST /api/manager/leads/:id/resolve-forward - Manager resolves forwarded lead (send back or reassign)
app.post('/api/manager/leads/:id/resolve-forward', authenticateToken, requireRole(['super_admin', 'manager', 'team_leader']), async (req, res) => {
  const leadId = req.params.id;
  const { action, targetCounselorId, managerRemark } = req.body;

  if (!action || !['send_back', 'reassign'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action. Must be "send_back" or "reassign".' });
  }

  try {
    if (req.user.role === 'team_leader') {
      const assignmentOwner = await db('lead_assignments')
        .join('users', 'lead_assignments.counselor_id', 'users.id')
        .where('lead_assignments.lead_id', leadId)
        .select('users.team_id')
        .first();
      if (!assignmentOwner || assignmentOwner.team_id !== req.user.team_id) {
        return res.status(403).json({ error: 'Access denied: Escalated lead belongs to another team.' });
      }
    }

    await db.transaction(async (trx) => {
      const assignment = await trx('lead_assignments').where({ lead_id: leadId }).first();
      if (!assignment) {
        throw new Error('Lead assignment not found.');
      }

      if (action === 'send_back') {
        // Send back to the original counselor: clear forwarded flag
        await trx('lead_assignments').where({ lead_id: leadId }).update({
          is_forwarded: false,
          forward_remark: null,
          forwarded_at: null,
          updated_at: new Date()
        });

        await logActivity(trx, leadId, req.user.id, 'forward_resolved_send_back', `Sent back to counselor. Manager note: ${managerRemark || 'None'}`);
      } else if (action === 'reassign') {
        if (!targetCounselorId) {
          throw new Error('targetCounselorId is required for reassignment.');
        }

        // Verify target counselor belongs to their team if user is team leader
        if (req.user.role === 'team_leader') {
          const targetUser = await trx('users').where({ id: targetCounselorId }).first();
          if (!targetUser || targetUser.team_id !== req.user.team_id) {
            throw new Error('Target counselor does not belong to your team.');
          }
        }

        // Reassign to target counselor and clear forwarded flag
        await trx('lead_assignments').where({ lead_id: leadId }).update({
          counselor_id: targetCounselorId,
          is_forwarded: false,
          forward_remark: null,
          forwarded_at: null,
          updated_at: new Date()
        });

        await logActivity(trx, leadId, req.user.id, 'forward_resolved_reassign', `Reassigned by manager. Manager note: ${managerRemark || 'None'}`);
      }
    });

    res.json({ message: 'Lead resolved successfully.' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to resolve forwarded lead' });
  }
});



// --- DAILY STATUS TRACKER ---

// GET /api/leads/daily-tracking?date=YYYY-MM-DD
// Manager: sees all assigned leads with activity on/created on that date
// Counselor: sees only their own assigned leads
app.get('/api/leads/daily-tracking', authenticateToken, requireRole(['manager', 'counselor', 'super_admin', 'team_leader']), async (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().slice(0, 10); // default today

  // Build date window: start of day to end of day (UTC)
  const dayStart = new Date(`${targetDate}T00:00:00.000Z`);
  const dayEnd   = new Date(`${targetDate}T23:59:59.999Z`);

  try {
    // Base query: all leads with assignment info
    let query = db('leads')
      .join('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .join('users as counselor_user', 'lead_assignments.counselor_id', 'counselor_user.id')
      .leftJoin('universities', 'leads.university_id', 'universities.id')
      .select(
        'leads.id',
        'leads.name',
        'leads.phone',
        'leads.email',
        'leads.city',
        'leads.state',
        'leads.experience',
        'leads.current_company',
        'leads.salary',
        'leads.graduation',
        'leads.course_interest',
        'leads.source',
        'leads.status as lead_status',
        'leads.created_at',
        'leads.updated_at',
        'leads.university_id',
        'universities.name as university_name',
        'lead_assignments.stage',
        'lead_assignments.disposition',
        'lead_assignments.assigned_at',
        'lead_assignments.updated_at as assignment_updated_at',
        'counselor_user.name as counselor_name',
        'counselor_user.id as counselor_id'
      );

    // Role restriction: counselors only see their own leads, team leaders see their team's leads
    if (req.user.role === 'counselor') {
      query = query.where('lead_assignments.counselor_id', req.user.id);
    } else if (req.user.role === 'team_leader') {
      if (!req.user.team_id) {
        return res.json({
          L1: [], L2: [], L3: [], interested: [], enrolled: [], dropped: [],
          not_interested: [], not_picked_up: [], switched_off: [], all: []
        });
      }
      query = query.where('counselor_user.team_id', req.user.team_id);
    }

    // Filter: leads that had any activity (created, assignment updated, or activity log) on the target date
    // We fetch all and filter by: lead created on date OR assignment updated on date OR activity log on date
    const leads = await query.orderBy('leads.created_at', 'asc');

    // Also fetch activity logs for this date for all relevant leads
    const leadIds = leads.map(l => l.id);
    let activityLogs = [];
    if (leadIds.length > 0) {
      let logQuery = db('lead_activity_log')
        .whereIn('lead_id', leadIds)
        .where('timestamp', '>=', dayStart)
        .where('timestamp', '<=', dayEnd)
        .select('lead_id', 'action', 'remark', 'timestamp');

      if (req.user.role === 'counselor') {
        logQuery = logQuery.where('counselor_id', req.user.id);
      }
      activityLogs = await logQuery;
    }

    const activeLeadIds = new Set(activityLogs.map(l => l.lead_id));

    // Filter leads that have activity on targetDate OR were created/assigned-updated on targetDate
    const filtered = leads.filter(lead => {
      const createdOnDate = lead.created_at >= dayStart && lead.created_at <= dayEnd;
      const assignmentUpdatedOnDate = lead.assignment_updated_at >= dayStart && lead.assignment_updated_at <= dayEnd;
      const hasActivityOnDate = activeLeadIds.has(lead.id);
      return createdOnDate || assignmentUpdatedOnDate || hasActivityOnDate;
    });

    // Categorize each lead
    const categorized = {
      L1: [],
      L2: [],
      L3: [],
      interested: [],
      enrolled: [],
      dropped: [],
      not_interested: [],
      not_picked_up: [],
      switched_off: [],
      all: []
    };

    filtered.forEach(lead => {
      const entry = {
        ...lead,
        activity_today: activityLogs.filter(a => a.lead_id === lead.id)
      };
      categorized.all.push(entry);

      // Closed/dropped leads
      if (lead.lead_status === 'closed' || lead.lead_status === 'invalid' || lead.lead_status === 'duplicate') {
        categorized.dropped.push(entry);
        return;
      }

      // Active pipeline
      if (lead.stage === 'L1') categorized.L1.push(entry);
      else if (lead.stage === 'L2') categorized.L2.push(entry);
      else if (lead.stage === 'L3') categorized.L3.push(entry);

      // Disposition buckets
      if (lead.disposition === 'Interested') categorized.interested.push(entry);
      else if (lead.disposition === 'Not Interested') categorized.not_interested.push(entry);
      else if (lead.disposition === 'Not Picked Up') categorized.not_picked_up.push(entry);
      else if (lead.disposition === 'Switched Off') categorized.switched_off.push(entry);
    });

    // Also fetch closures for enrolled on date
    const closures = await db('closures')
      .whereIn('lead_id', leadIds)
      .where('final_status', 'enrolled')
      .where('closed_at', '>=', dayStart)
      .where('closed_at', '<=', dayEnd)
      .join('leads', 'closures.lead_id', 'leads.id')
      .leftJoin('universities', 'closures.university_id', 'universities.id')
      .select(
        'leads.id',
        'leads.name',
        'leads.phone',
        'leads.email',
        'leads.city',
        'leads.state',
        'leads.course_interest',
        'closures.final_status',
        'closures.revenue',
        'closures.closed_at',
        'universities.name as university_name'
      );

    categorized.enrolled = closures;

    res.json({
      date: targetDate,
      summary: {
        total: filtered.length,
        L1: categorized.L1.length,
        L2: categorized.L2.length,
        L3: categorized.L3.length,
        interested: categorized.interested.length,
        enrolled: categorized.enrolled.length,
        dropped: categorized.dropped.length,
        not_interested: categorized.not_interested.length,
        not_picked_up: categorized.not_picked_up.length,
        switched_off: categorized.switched_off.length
      },
      categories: categorized
    });

  } catch (err) {
    console.error('Daily tracking failed:', err);
    res.status(500).json({ error: 'Failed to fetch daily tracking data' });
  }
});


// --- AUDIT & ACTIVITY LOG ENDPOINTS ---

// GET /api/logs/counselor-activity  (manager: all counselor/team activity with lead info)
// Query params: counselor_id, action_type, date_from, date_to, search
app.get('/api/logs/counselor-activity', authenticateToken, requireRole(['manager', 'super_admin', 'team_leader']), async (req, res) => {
  const { counselor_id, action_type, date_from, date_to, search } = req.query;
  try {
    let query = db('lead_activity_log as log')
      .join('users as u', 'log.counselor_id', 'u.id')
      .leftJoin('leads as l', 'log.lead_id', 'l.id')
      .where('u.role', 'counselor');

    if (req.user.role === 'team_leader') {
      if (!req.user.team_id) {
        return res.json([]);
      }
      query = query.where('u.team_id', req.user.team_id);
    }

    query = query.select(
        'log.id',
        'log.action',
        'log.remark',
        'log.timestamp',
        'log.lead_id',
        'u.id as counselor_id',
        'u.name as counselor_name',
        'u.company_email as counselor_email',
        'l.name as lead_name',
        'l.phone as lead_phone',
        'l.city as lead_city',
        'l.course_interest as lead_course'
      )
      .orderBy('log.timestamp', 'desc')
      .limit(1000);

    if (counselor_id) {
      query = query.where('log.counselor_id', counselor_id);
    }
    if (action_type) {
      query = query.where('log.action', action_type);
    }
    if (date_from) {
      query = query.where('log.timestamp', '>=', new Date(`${date_from}T00:00:00.000Z`));
    }
    if (date_to) {
      query = query.where('log.timestamp', '<=', new Date(`${date_to}T23:59:59.999Z`));
    }
    if (search) {
      const q = `%${search.toLowerCase()}%`;
      query = query.where(function() {
        this.where(db.raw('LOWER(u.name)'), 'like', q)
            .orWhere(db.raw('LOWER(log.remark)'), 'like', q)
            .orWhere(db.raw('LOWER(l.name)'), 'like', q)
            .orWhere(db.raw('LOWER(l.phone)'), 'like', q);
      });
    }

    const logs = await query;
    res.json(logs);
  } catch (err) {
    console.error('Counselor activity log fetch failed:', err);
    res.status(500).json({ error: 'Failed to fetch counselor activity logs' });
  }
});


// --- SERVER INITIALIZATION ---

// Global error handler: catches multer/body-parser/CORS errors and anything else
// that reaches Express without a route-level try/catch, so clients always get a
// clean JSON response instead of a raw HTML page with a stack trace.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({ error: 'An unexpected server error occurred.' });
});

app.listen(PORT, () => {
  console.log(`Backend API Server running on port ${PORT}`);
});
