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

const dotenv = require('dotenv');
dotenv.config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const db = require('./db');
const { authenticateToken, requireRole, generateToken } = require('./auth');
const hiringRouter = require('./modules/hiring/routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust the single reverse proxy in front of us (nginx in production, cloudflared/localtunnel
// for ad-hoc sharing) so req.ip and express-rate-limit read the real client IP from
// X-Forwarded-For instead of throwing/misattributing every request to the proxy's own IP.
app.set('trust proxy', 1);

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
// This server only ever returns JSON, so helmet's default Content-Security-Policy (meant for
// HTML documents) is switched off here — the CSP that actually matters lives in
// frontend/index.html's <meta> tag, applied to the page the browser renders. What's still
// useful on a JSON API: X-Content-Type-Options (blocks MIME-sniffing an API response into
// executable content) and the rest of helmet's non-CSP hardening headers.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

// Login brute-force protection: 10 attempts per IP per 15 minutes. Deliberately not keyed by
// email too — an attacker rotating emails against one password (credential stuffing) is still
// throttled by IP, and keying by email as well would let an attacker lock out a known victim's
// account by deliberately failing their login from elsewhere (a denial-of-service side door).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

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

// Helper to serialize Date objects for database queries (handles SQLite vs Postgres difference)
function serializeDate(date) {
  if (!date) return null;
  const isSqlite = db.client.config.client === 'sqlite3';
  return isSqlite ? (date instanceof Date ? date.getTime() : new Date(date).getTime()) : date;
}

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

// Fixed prefix used whenever a lead's flat counseling status changes (see
// PUT /api/counselor/leads/:id/status below). Kept as a constant so reports can reliably
// strip it back off to recover the status value from the log entry.
const STATUS_LOG_PREFIX = 'Counseling status changed to: ';

// The flat status model replacing the old L1/L2/L3 stage pipeline. 'Not Contacted' is
// the default before a counselor has done anything with a freshly allocated lead.
const COUNSELING_STATUSES = ['Not Contacted', 'Interested', 'Call Back', 'Cold', 'Not Interested', 'Not Contactable', 'Lead Punched', 'Duplicate Lead', 'Job Seeker'];
const NOT_CONTACTABLE_REASONS = ['Switch Off', 'Out of Coverage', 'Not Picked', 'Call Fail', 'Wrong Number', 'Others'];
// Statuses that immediately close out a lead (assignment deleted, closures row written).
// 'Lead Punched' is ALSO terminal, but only once fee_payment_status becomes 'Full' —
// that transition is handled separately since it depends on a second field, not just
// counseling_status alone.
const TERMINAL_STATUSES = ['Not Interested', 'Duplicate Lead', 'Job Seeker'];
const FEE_PAYMENT_STATUSES = ['None', 'Partial', 'Full'];
const REGISTRATION_STATUSES = ['Not Registered', 'Registered'];
// Whether this contact is a fresh application ('Created') or already existed as a lead at
// another university before ('Existed', with existed_university_id recording which one).
const LEAD_TYPES = ['Created', 'Existed'];
// Independent intent classification for Interested/Lead Punched/Duplicate Lead leads —
// distinct from the 'Cold' counseling_status, which is about contact-ability, not intent.
const LEAD_TEMPERATURES = ['Hot', 'Warm', 'Cold'];
const DEFAULT_FEE_REMINDER_DAYS = 7;

// Resolve a 'today' | 'week' | 'month' | 'all' shorthand into a concrete UTC date
// range for report filtering. 'week' and 'month' are calendar-aligned (Monday start),
// not a rolling window. Returns null for 'all' (or anything unrecognized), meaning
// "no date filter".
//
// IST (the business's actual timezone) throughout, NOT UTC — a pure-UTC "today" is wrong
// for up to 5.5 hours around every IST midnight (e.g. 2:00 AM IST is still "yesterday" in
// UTC), which silently misbucketed touched-lead counts, daily tracking, and status-history
// reports right around that window. See getCurrentMonthKeyIST below, which already
// documented and fixed this exact class of bug for monthly targets — this generalizes the
// same fix to every other "today"/"week"/"month"/custom-date-range report.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// 'YYYY-MM-DD' for the IST calendar date of `date` (defaults to now).
function getISTDateString(date = new Date()) {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

// Given an IST calendar date string 'YYYY-MM-DD', returns { start, end } as real UTC
// instants marking IST 00:00:00.000 and 23:59:59.999 of that day — use this instead of
// `new Date(`${dateStr}T00:00:00.000Z`)` for any user-facing date filter/boundary, since
// the Z-suffixed form reads the string as UTC midnight rather than IST midnight.
function getISTDayRange(dateStr) {
  return {
    start: new Date(`${dateStr}T00:00:00.000+05:30`),
    end: new Date(`${dateStr}T23:59:59.999+05:30`)
  };
}

function getPeriodRange(period) {
  const todayStr = getISTDateString();
  if (period === 'today') {
    return getISTDayRange(todayStr);
  }
  if (period === 'week') {
    const [y, m, d] = todayStr.split('-').map(Number);
    const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const mondayStr = new Date(Date.UTC(y, m - 1, d - diffToMonday)).toISOString().slice(0, 10);
    const sundayStr = new Date(Date.UTC(y, m - 1, d - diffToMonday + 6)).toISOString().slice(0, 10);
    return { start: getISTDayRange(mondayStr).start, end: getISTDayRange(sundayStr).end };
  }
  if (period === 'month') {
    const [y, m] = todayStr.split('-').map(Number);
    const firstStr = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastStr = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // day 0 of next month = last day of this one
    return { start: getISTDayRange(firstStr).start, end: getISTDayRange(lastStr).end };
  }
  return null;
}

// 'YYYY-MM' for the current IST calendar month — used to bucket monthly counselor targets.
// Deliberately IST (the business's actual timezone), NOT UTC like a naive
// `new Date().toISOString().substring(0,7)` would read — see getPeriodRange above for the
// same class of bug generalized across every other date-bounded report.
function getCurrentMonthKeyIST() {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().substring(0, 7);
}

// Reduce a lead's activity log into a Data Status (L1) breakdown, counting each lead
// AT MOST ONCE — its most recent 'status_change' entry in the log window given. `logs` =
// [{ lead_id, action, remark, timestamp }], any order, already filtered to the desired
// reporting window by the caller.
function computeStatusSummary(logs) {
  const sorted = [...logs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const latestPerLead = new Map(); // lead_id -> latest counseling_status in this window

  sorted.forEach(log => {
    if (!log.lead_id || log.action !== 'status_change') return;
    if (!log.remark || !log.remark.startsWith(STATUS_LOG_PREFIX)) return;
    // Strip the optional " (<reason>)" suffix (only ever appended for Not Contactable,
    // see STATUS_LOG_PREFIX usage around notContactableReason) so the fixed-bucket match
    // below recognizes it — otherwise "Not Contactable (Wrong Number)" never equals
    // 'Not Contactable' and that bucket stays permanently at 0.
    const status = log.remark.slice(STATUS_LOG_PREFIX.length).split(' — ')[0].trim().replace(/\s*\([^)]*\)$/, '');
    latestPerLead.set(log.lead_id, status);
  });

  // 'Not Contacted' is a real, reachable value here too — a counselor can select it back
  // in the Update Status dropdown (it's in COUNSELING_STATUSES like every other option),
  // logging a genuine status_change entry. Without its own bucket, `total` (incremented
  // unconditionally below) would silently exceed the sum of the named buckets whenever
  // that happens.
  const summary = { total: 0, not_contacted: 0, interested: 0, call_back: 0, cold: 0, not_interested: 0, not_contactable: 0, lead_punched: 0, duplicate_lead: 0, job_seeker: 0 };
  latestPerLead.forEach(status => {
    summary.total += 1;
    if (status === 'Not Contacted') summary.not_contacted += 1;
    else if (status === 'Interested') summary.interested += 1;
    else if (status === 'Call Back') summary.call_back += 1;
    else if (status === 'Cold') summary.cold += 1;
    else if (status === 'Not Interested') summary.not_interested += 1;
    else if (status === 'Not Contactable') summary.not_contactable += 1;
    else if (status === 'Lead Punched') summary.lead_punched += 1;
    else if (status === 'Duplicate Lead') summary.duplicate_lead += 1;
    else if (status === 'Job Seeker') summary.job_seeker += 1;
  });
  return summary;
}

// Reconstruct each lead's counseling_status AS OF THE END OF EACH DAY it had activity, by
// replaying its 'status_change' log entries chronologically. Used by the counselor
// "work history by day" endpoints, which need to know what a lead's status actually was
// on a past date rather than stamping every historical date with today's live status.
// `logs` = [{ lead_id, action, remark, timestamp }], any order.
// Returns { dateStr: { lead_id: counseling_status } }.
function reconstructDailyStatusStates(logs) {
  const sorted = [...logs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const runningState = {}; // lead_id -> current counseling_status
  const dateStateMap = {}; // dateStr -> { lead_id: status }

  sorted.forEach(log => {
    const leadId = log.lead_id;
    if (!leadId) return;
    if (!(leadId in runningState)) runningState[leadId] = 'Not Contacted';

    if (log.action === 'status_change' && log.remark && log.remark.startsWith(STATUS_LOG_PREFIX)) {
      runningState[leadId] = log.remark.slice(STATUS_LOG_PREFIX.length).split(' — ')[0].trim();
    }

    // IST calendar date, not UTC — a status change just after IST midnight (still "today"
    // for the counselor) would otherwise land in yesterday's bucket, silently misattributing
    // it to the wrong day in "work history by day".
    const dateStr = getISTDateString(new Date(log.timestamp));
    if (!dateStateMap[dateStr]) dateStateMap[dateStr] = {};
    dateStateMap[dateStr][leadId] = runningState[leadId];
  });

  return dateStateMap;
}

// Compute the Fresh Allocation / Carry Forward / Touch% "Data Report" for one or more
// counselors. Fresh Base / Opening CF are derived live from lead_assignments.assigned_at
// (today vs earlier), and Touched Base from whether a lead has any lead_activity_log entry
// today. Scope with EXACTLY ONE of `counselorIds` (explicit list, e.g. a single self-scoped
// counselor) or `teamId` (team-scoped); omit both for a company-wide view.
//
// Also splits today's Carry Forward pool into "ahead" (status moved off Not Contacted —
// including CF leads closed out entirely today) vs "pending" (still sitting untouched at
// Not Contacted). CF leads that were closed today (enrolled/lost/duplicate/job_seeker) no
// longer have a lead_assignments row to count — their assigned_at is recovered from
// closures.assignment_assigned_at (see migration
// 20260718120000_add_assignment_assigned_at_to_closures.js), snapshotted at the moment they
// closed. Closures written before that migration have a null snapshot and are excluded from
// the CF/Fresh split (counted only in cfOriginalTotal via the still-open leads).
// Returns { perCounselor: [...], aggregate: {...} }.
async function computeDataReport(dbOrTrx, { counselorIds, teamId } = {}) {
  const todayRange = getPeriodRange('today');

  let baseQuery = dbOrTrx('lead_assignments').join('users', 'lead_assignments.counselor_id', 'users.id');
  if (counselorIds && counselorIds.length > 0) {
    baseQuery = baseQuery.whereIn('lead_assignments.counselor_id', counselorIds);
  } else if (teamId) {
    baseQuery = baseQuery.where('users.team_id', teamId);
  }

  const rows = await baseQuery.select(
    'lead_assignments.counselor_id',
    'users.name as counselor_name',
    'lead_assignments.lead_id',
    'lead_assignments.assigned_at',
    'lead_assignments.counseling_status'
  );

  const counselorMap = {};
  const getOrCreate = (id, name) => {
    if (!counselorMap[id]) {
      counselorMap[id] = { id, name, openingCF: 0, freshBase: 0, totalBase: 0, touchedBase: 0, touchPct: 0, cfAhead: 0, cfPending: 0, cfClosedToday: 0, leadIds: [] };
    }
    return counselorMap[id];
  };

  rows.forEach(r => {
    const entry = getOrCreate(r.counselor_id, r.counselor_name);
    entry.totalBase += 1;
    entry.leadIds.push(r.lead_id);
    const assignedAt = new Date(r.assigned_at);
    const isFresh = assignedAt >= todayRange.start && assignedAt <= todayRange.end;
    if (isFresh) {
      entry.freshBase += 1;
    } else {
      entry.openingCF += 1;
      if (r.counseling_status === 'Not Contacted') entry.cfPending += 1;
      else entry.cfAhead += 1;
    }
  });

  const allLeadIds = rows.map(r => r.lead_id);
  let touchedLeadIds = new Set();
  if (allLeadIds.length > 0) {
    const touchLogs = await dbOrTrx('lead_activity_log')
      .whereIn('lead_id', allLeadIds)
      // Exclude 'distributed' — it's written automatically the moment a lead is allocated
      // to a counselor (see /api/leads/distribute), not when the counselor actually does
      // anything with it. Without this, every freshly-distributed lead counted as "touched"
      // on day one regardless of whether the counselor had made a single call, inflating
      // touchedBase/touchPct to look like leads were being worked when they hadn't been.
      .whereNot('action', 'distributed')
      .where('timestamp', '>=', serializeDate(todayRange.start))
      .where('timestamp', '<=', serializeDate(todayRange.end))
      .distinct('lead_id')
      .select('lead_id');
    touchedLeadIds = new Set(touchLogs.map(t => t.lead_id));
  }

  // CF leads closed out entirely today (enrolled/lost/duplicate/job_seeker) — their
  // lead_assignments row is gone, so pull them from closures via the assigned_at snapshot.
  let closedTodayQuery = dbOrTrx('closures')
    .join('users', 'closures.counselor_id', 'users.id')
    .where('closures.closed_at', '>=', serializeDate(todayRange.start))
    .where('closures.closed_at', '<=', serializeDate(todayRange.end))
    .where('closures.assignment_assigned_at', '<', serializeDate(todayRange.start))
    .groupBy('closures.counselor_id', 'users.name')
    .select('closures.counselor_id', 'users.name as counselor_name')
    .count('closures.id as cnt');
  if (counselorIds && counselorIds.length > 0) {
    closedTodayQuery = closedTodayQuery.whereIn('closures.counselor_id', counselorIds);
  } else if (teamId) {
    closedTodayQuery = closedTodayQuery.where('users.team_id', teamId);
  }
  const closedTodayRows = await closedTodayQuery;
  closedTodayRows.forEach(r => {
    const entry = getOrCreate(r.counselor_id, r.counselor_name);
    entry.cfClosedToday = parseInt(r.cnt, 10);
  });

  const perCounselor = Object.values(counselorMap).map(entry => {
    const touchedBase = entry.leadIds.filter(id => touchedLeadIds.has(id)).length;
    const touchPct = entry.totalBase > 0 ? Math.round((touchedBase / entry.totalBase) * 1000) / 10 : 0;
    const cfOriginalTotal = entry.openingCF + entry.cfClosedToday;
    return {
      id: entry.id, name: entry.name, openingCF: entry.openingCF, freshBase: entry.freshBase,
      totalBase: entry.totalBase, touchedBase, touchPct,
      cfAhead: entry.cfAhead, cfPending: entry.cfPending, cfClosedToday: entry.cfClosedToday, cfOriginalTotal
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const aggregate = perCounselor.reduce((acc, c) => {
    acc.openingCF += c.openingCF;
    acc.freshBase += c.freshBase;
    acc.totalBase += c.totalBase;
    acc.touchedBase += c.touchedBase;
    acc.cfAhead += c.cfAhead;
    acc.cfPending += c.cfPending;
    acc.cfClosedToday += c.cfClosedToday;
    acc.cfOriginalTotal += c.cfOriginalTotal;
    return acc;
  }, { openingCF: 0, freshBase: 0, totalBase: 0, touchedBase: 0, cfAhead: 0, cfPending: 0, cfClosedToday: 0, cfOriginalTotal: 0 });
  aggregate.touchPct = aggregate.totalBase > 0 ? Math.round((aggregate.touchedBase / aggregate.totalBase) * 1000) / 10 : 0;

  return { perCounselor, aggregate };
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
  return email.toLowerCase().endsWith('@skilllabs.net');
}

// CSV/Excel formula-injection guard: a lead's name/company/source/etc. can originate from a
// bulk-uploaded file or a counselor's free-text edit, so a cell value of "=CMD(...)" or
// "@SUM(...)" would be interpreted as a live formula by Excel/Sheets when this row is later
// exported and opened. Prefixing with a single quote forces spreadsheet apps to render it as
// literal text instead of evaluating it. Applied to every row/column just before json_to_sheet.
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

// Login endpoint — email + password authentication
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { email, password, deviceId, force } = req.body;

  // One generic message for "no such account" and "wrong password" — returning distinct
  // errors let an attacker enumerate valid @skilllabs.net accounts before even guessing
  // passwords against them.
  const invalidCredentials = () => res.status(401).json({ error: 'Incorrect email or password.' });

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (!isValidDomain(email)) {
    return res.status(400).json({ error: 'Access restricted: Only @skilllabs.net accounts are permitted.' });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await db('users').where({ company_email: normalizedEmail }).first();

    if (!user) {
      return invalidCredentials();
    }

    if (!user.active) {
      return res.status(403).json({ error: 'Your account is currently deactivated.' });
    }

    if (!user.password_hash) {
      return invalidCredentials();
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return invalidCredentials();
    }

    // Session conflict check
    const isForcedTakeover = Boolean(user.device_id && user.device_id !== deviceId && force);
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

    // Write login activity with user ID recorded — forced takeovers get a distinct remark
    // so the audit trail shows when a previous session was kicked out, not just a plain login.
    await db('lead_activity_log').insert({
      id: randomUUID(),
      lead_id: null,
      counselor_id: user.id,
      action: 'login',
      remark: isForcedTakeover
        ? `${user.name} (${user.role}) logged in — Device: ${deviceId} (forced termination of previous active session)`
        : `${user.name} (${user.role}) logged in — Device: ${deviceId}`,
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
    const { password_hash, ...safeUser } = req.user;
    res.json({ user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve current user session profile' });
  }
});

// Get team counselors
app.get('/api/users/counselors', authenticateToken, requireRole(['super_admin', 'manager', 'team_leader']), async (req, res) => {
  try {
    let query = db('users')
      .where({ role: 'counselor', active: true })
      .select('id', 'name', 'company_email', 'role', 'team_id', 'active', 'created_at', 'updated_at');

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
    const currentMonth = getCurrentMonthKeyIST();
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
      .select(
        'users.id', 'users.name', 'users.company_email', 'users.role', 'users.team_id',
        'users.hiring_team_id', 'users.device_id', 'users.active', 'users.created_at', 'users.updated_at',
        'teams.name as team_name'
      )
      .orderBy('users.created_at', 'desc');
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users list' });
  }
});

// Create a new user (counselor, manager, team_leader, super_admin)
app.post('/api/admin/users', authenticateToken, requireRole(['super_admin']), async (req, res) => {
  const { name, email, password, role, teamId } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, company email, password, and role are required.' });
  }
  if (!isValidDomain(email)) {
    return res.status(400).json({ error: 'Invalid email domain. Only @skilllabs.net is allowed.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }
  try {
    const existing = await db('users').where({ company_email: email.trim().toLowerCase() }).first();
    if (existing) {
      return res.status(400).json({ error: 'A user with this email already exists.' });
    }
    const newUserId = randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);
    await db('users').insert({
      id: newUserId,
      name: name.trim(),
      company_email: email.trim().toLowerCase(),
      password_hash: passwordHash,
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

// Reset a user's password (admin-managed accounts, no self-service reset flow)
app.put('/api/admin/users/:id/reset-password', authenticateToken, requireRole(['super_admin']), async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }
  try {
    const user = await db('users').where({ id }).first();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await db('users').where({ id }).update({
      password_hash: passwordHash,
      updated_at: new Date()
    });

    await db('lead_activity_log').insert({
      id: randomUUID(),
      action: 'note',
      remark: `Password reset for user ${user.name}`,
      timestamp: new Date()
    });

    res.json({ id, message: 'Password reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Edit a user's name and/or company email
app.put('/api/admin/users/:id', authenticateToken, requireRole(['super_admin']), async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and company email are required.' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!isValidDomain(normalizedEmail)) {
    return res.status(400).json({ error: 'Invalid email domain. Only @skilllabs.net is allowed.' });
  }
  try {
    const user = await db('users').where({ id }).first();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const existing = await db('users').where({ company_email: normalizedEmail }).whereNot({ id }).first();
    if (existing) {
      return res.status(400).json({ error: 'A user with this email already exists.' });
    }

    await db('users').where({ id }).update({
      name: name.trim(),
      company_email: normalizedEmail,
      updated_at: new Date()
    });

    await db('lead_activity_log').insert({
      id: randomUUID(),
      action: 'note',
      remark: `Updated user ${user.name} -> name: ${name.trim()}, email: ${normalizedEmail}`,
      timestamp: new Date()
    });

    res.json({ id, name: name.trim(), email: normalizedEmail });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update user account' });
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

    // Completely blank rows (no cell has any value) are skipped above without landing in
    // any of clean/duplicate/invalid, so rows.length can be larger than their sum whenever
    // the sheet has blank rows — using it as "total" made total_rows disagree with
    // clean_rows + duplicate_rows + invalid_rows on the Upload Trend / repository stats.
    const totalProcessedRows = cleanLeads.length + duplicateLeads.length + invalidLeads.length;

    // Write in transaction
    await db.transaction(async (trx) => {
      // 1. Create upload batch record
      await trx('upload_batches').insert({
        id: batchId,
        uploaded_by: req.user.id,
        file_name: req.file.originalname,
        upload_date: new Date(),
        total_rows: totalProcessedRows,
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
      total: totalProcessedRows,
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

    // Assigned Counselor falls back to closures.counselor_id — dropping a lead deletes
    // its lead_assignments row, so relying on that join alone leaves every dropped lead's
    // "Assigned Counselor" blank in the exported file even though we know who worked it.
    const leads = await db('leads')
      .leftJoin('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .leftJoin('users', 'lead_assignments.counselor_id', 'users.id')
      .leftJoin('closures', 'leads.id', 'closures.lead_id')
      .leftJoin('users as closure_counselors', 'closures.counselor_id', 'closure_counselors.id')
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
        db.raw('COALESCE(users.name, closure_counselors.name) as "Assigned Counselor"'),
        'lead_assignments.counseling_status as Counseling Status',
        'leads.status as Data Status',
        'leads.created_at as Upload Date'
      )
      .where({ 'leads.upload_batch_id': batchId })
      .orderBy('leads.created_at', 'asc');

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(sanitizeForExport(leads));
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
    // Assigned Counselor falls back to closures.counselor_id — dropping a lead deletes
    // its lead_assignments row, so relying on that join alone leaves every dropped lead's
    // "Assigned Counselor" blank in the exported file even though we know who worked it.
    const leads = await db('leads')
      .leftJoin('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .leftJoin('users', 'lead_assignments.counselor_id', 'users.id')
      .leftJoin('closures', 'leads.id', 'closures.lead_id')
      .leftJoin('users as closure_counselors', 'closures.counselor_id', 'closure_counselors.id')
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
        db.raw('COALESCE(users.name, closure_counselors.name) as "Assigned Counselor"'),
        'lead_assignments.counseling_status as Counseling Status',
        'leads.status as Data Status',
        'leads.created_at as Upload Date'
      )
      .orderBy('leads.created_at', 'asc');

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(sanitizeForExport(leads));
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
      query = query.where(function () {
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
      query = query.where('leads.created_at', '>=', serializeDate(new Date(start_date)));
    }

    if (end_date) {
      query = query.where('leads.created_at', '<=', serializeDate(new Date(end_date)));
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
      // Re-apply the SAME pool filters as GET /api/leads/pool, inside the transaction (both
      // to prevent race conditions AND because the manager's on-screen "N leads available"
      // count and preview came from that filtered pool — without re-applying city/state/
      // source/interest/experience/date/university here too, this pulled from the ENTIRE
      // clean/unassigned pool regardless of what was actually filtered on screen, silently
      // handing counselors leads outside the criteria the manager thought they'd scoped to.
      const { location, city, state, source, interest, start_date, end_date, min_exp, max_exp, university_id } = filterCriteria || {};

      let query = trx('leads')
        .leftJoin('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
        .where({ 'leads.status': 'clean' })
        .whereNull('lead_assignments.id')
        .select('leads.id', 'leads.experience')
        .forUpdate(); // Lock leads rows during transaction!

      if (sourceBatchId) {
        query = query.where({ 'leads.upload_batch_id': sourceBatchId });
      }

      if (location) {
        const locLower = String(location).toLowerCase();
        query = query.where(function () {
          this.where(trx.raw('LOWER(leads.city)'), 'like', `%${locLower}%`)
            .orWhere(trx.raw('LOWER(leads.state)'), 'like', `%${locLower}%`);
        });
      }
      if (city) {
        query = query.where(trx.raw('LOWER(leads.city)'), '=', city.toLowerCase());
      }
      if (state) {
        query = query.where(trx.raw('LOWER(leads.state)'), '=', state.toLowerCase());
      }
      if (source) {
        query = query.where(trx.raw('LOWER(leads.source)'), 'like', `%${String(source).toLowerCase()}%`);
      }
      if (interest) {
        query = query.where(trx.raw('LOWER(leads.course_interest)'), 'like', `%${String(interest).toLowerCase()}%`);
      }
      if (university_id) {
        query = query.where({ 'leads.university_id': university_id });
      }
      if (min_exp) {
        query = query.where('leads.experience', '>=', parseFloat(min_exp));
      }
      if (max_exp) {
        query = query.where('leads.experience', '<=', parseFloat(max_exp));
      }
      if (start_date) {
        query = query.where('leads.created_at', '>=', serializeDate(new Date(start_date)));
      }
      if (end_date) {
        query = query.where('leads.created_at', '<=', serializeDate(new Date(end_date)));
      }

      const availableLeads = await query.orderBy('leads.created_at', 'asc');

      if (availableLeads.length < totalRequested) {
        throw new Error(`Insufficient leads in the pool. Requested: ${totalRequested}, Available: ${availableLeads.length}`);
      }

      // Split the pool into freshers (no experience) and experienced candidates so that
      // every counselor gets a proportional mix of both — instead of whichever leads
      // happen to fall next in upload order. Each list stays FIFO (oldest lead first)
      // within its own category.
      const fresherPool = availableLeads.filter(l => !l.experience || l.experience <= 0);
      const experiencedPool = availableLeads.filter(l => l.experience > 0);
      let fPtr = 0, ePtr = 0;
      let fRemaining = fresherPool.length;
      let eRemaining = experiencedPool.length;

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

      for (const alloc of allocations) {
        const count = parseInt(alloc.count, 10);
        if (count <= 0) continue;

        // Verify counselor is active
        const counselor = await trx('users').where({ id: alloc.counselorId, role: 'counselor', active: true }).first();
        if (!counselor) {
          throw new Error(`Counselor ${alloc.counselorId} is not active or invalid.`);
        }

        // Proportional split based on the CURRENT remaining mix, so the ratio of
        // freshers to experienced stays consistent across every counselor's share —
        // e.g. a 60/40 fresher/experienced pool gives every counselor a ~60/40 batch,
        // rather than whichever counselor happens to be allocated first draining one
        // category dry and leaving the rest all-fresher or all-experienced.
        const totalRemaining = fRemaining + eRemaining;
        let fShare = totalRemaining > 0 ? Math.round(count * fRemaining / totalRemaining) : 0;
        fShare = Math.min(fShare, fRemaining, count);
        let eShare = count - fShare;
        if (eShare > eRemaining) {
          const shortfall = eShare - eRemaining;
          eShare = eRemaining;
          fShare += shortfall;
        }

        const batchLeads = [
          ...fresherPool.slice(fPtr, fPtr + fShare),
          ...experiencedPool.slice(ePtr, ePtr + eShare)
        ];
        fPtr += fShare;
        fRemaining -= fShare;
        ePtr += eShare;
        eRemaining -= eShare;

        const allocatedIds = [];
        for (const lead of batchLeads) {
          allocatedIds.push(lead.id);

          // Assign lead
          await trx('lead_assignments').insert({
            id: randomUUID(),
            lead_id: lead.id,
            counselor_id: counselor.id,
            assigned_by: req.user.id,
            assigned_at: new Date(),
            stage: 'L1',
            counseling_status: 'Not Contacted',
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
  const { counselingStatus, is_due_followup } = req.query;

  try {
    // Each lead's next still-open follow-up date (if any), so the frontend can derive
    // "due today" / "Call Back" scheduling client-side from this one payload instead of
    // needing a second, separately-filtered request just for the Follow-ups tab.
    const followUpSubquery = db('follow_ups')
      .where({ counselor_id: req.user.id, completed: false })
      .groupBy('lead_id')
      .select('lead_id')
      .max('follow_up_date as next_follow_up_date')
      .as('fu');

    let query = db('leads')
      .join('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .leftJoin('universities', 'leads.university_id', 'universities.id')
      .leftJoin('universities as existed_universities', 'leads.existed_university_id', 'existed_universities.id')
      .leftJoin('closures', 'leads.id', 'closures.lead_id')
      .leftJoin(followUpSubquery, 'leads.id', 'fu.lead_id')
      .where({ 'lead_assignments.counselor_id': req.user.id })
      .select(
        'leads.*',
        'existed_universities.name as existed_university_name',
        'lead_assignments.locked',
        'lead_assignments.assigned_at',
        'lead_assignments.counseling_status',
        'lead_assignments.not_contactable_reason',
        'lead_assignments.status_remark',
        'lead_assignments.registration_status',
        'lead_assignments.registration_date',
        'lead_assignments.fee_payment_status',
        'lead_assignments.fee_amount_paid',
        'lead_assignments.fee_total_amount',
        'lead_assignments.fee_reminder_due_at',
        'lead_assignments.fee_reminder_note',
        'lead_assignments.fee_reminder_acknowledged',
        'lead_assignments.is_forwarded',
        'lead_assignments.forward_remark',
        'lead_assignments.forwarded_at',
        'lead_assignments.escalation_category',
        'universities.name as university_name',
        'closures.documents_status as documents_status',
        'closures.application_status as application_status',
        'closures.revenue as closure_revenue',
        'fu.next_follow_up_date'
      );

    if (counselingStatus) {
      query = query.where({ 'lead_assignments.counseling_status': counselingStatus });
    }

    let leads = await query.orderBy('leads.created_at', 'desc');

    // Optional server-side narrowing, kept for backward compatibility — the dashboard
    // itself now derives the Follow-ups Due view client-side from next_follow_up_date
    // instead of requesting this separately, so the full base and the due-list are
    // always counted from the exact same fetch.
    if (is_due_followup === 'true') {
      const now = new Date();
      leads = leads.filter(l => l.next_follow_up_date && new Date(l.next_follow_up_date) <= now);
    }

    res.json(leads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch counselor leads' });
  }
});

// Leads that came back from an escalation the counselor raised — either sent back by the
// manager/team leader, or reassigned to this counselor as part of resolving someone else's
// escalation — that the counselor hasn't acted on since. escalation_resolved_at is set the
// moment a manager resolves an escalation (see /api/manager/leads/:id/resolve-forward) and
// cleared the moment the counselor updates the lead's status again, so this list is
// self-clearing: it only ever shows leads genuinely waiting on the counselor right now.
app.get('/api/counselor/leads/escalation-returns', authenticateToken, requireRole(['counselor']), async (req, res) => {
  try {
    const leads = await db('leads')
      .join('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .leftJoin('universities', 'leads.university_id', 'universities.id')
      .where({ 'lead_assignments.counselor_id': req.user.id })
      .whereNotNull('lead_assignments.escalation_resolved_at')
      .select(
        'leads.*',
        'lead_assignments.locked',
        'lead_assignments.assigned_at',
        'lead_assignments.counseling_status',
        'lead_assignments.not_contactable_reason',
        'lead_assignments.status_remark',
        'lead_assignments.registration_status',
        'lead_assignments.fee_payment_status',
        'lead_assignments.fee_amount_paid',
        'lead_assignments.fee_total_amount',
        'lead_assignments.fee_reminder_due_at',
        'lead_assignments.escalation_category',
        'lead_assignments.escalation_resolved_at',
        'lead_assignments.escalation_resolution_type',
        'lead_assignments.escalation_resolution_note',
        'universities.name as university_name'
      )
      .orderBy('lead_assignments.escalation_resolved_at', 'desc');

    res.json(leads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch escalation returns' });
  }
});

// Lightweight due-follow-ups count for the always-visible sidebar badge. Deliberately a
// single COUNT query against follow_ups rather than routing through /api/counselor/leads —
// that endpoint joins leads/universities/closures for the whole active base, which is a lot
// of data to pull across the wire just to read a number off the end of it.
// Joined against lead_assignments so a follow-up left incomplete on a lead that has since
// been closed out (enrolled/dropped) doesn't keep inflating the count — the closure path
// now completes those going forward, but this guards against any that slip through. The
// join also requires lead_assignments.counselor_id to match — a transfer/reassignment
// carries the follow-up's counselor_id forward to the new owner, but this stays as a
// second guard against ever counting a lead for a counselor who no longer owns it.
app.get('/api/counselor/followups/count', authenticateToken, requireRole(['counselor']), async (req, res) => {
  try {
    const row = await db('follow_ups')
      .join('lead_assignments', function () {
        this.on('follow_ups.lead_id', '=', 'lead_assignments.lead_id')
          .andOn('follow_ups.counselor_id', '=', 'lead_assignments.counselor_id');
      })
      .where({ 'follow_ups.counselor_id': req.user.id, 'follow_ups.completed': false })
      .where('follow_ups.follow_up_date', '<=', serializeDate(new Date()))
      .count('follow_ups.id as count')
      .first();
    res.json({ count: parseInt(row.count || 0, 10) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch due follow-ups count' });
  }
});

// Get counselor's dropped leads
app.get('/api/counselor/leads/dropped', authenticateToken, requireRole(['counselor']), async (req, res) => {
  try {
    const droppedLeads = await db('leads')
      .join('closures', 'leads.id', 'closures.lead_id')
      .leftJoin('universities', 'closures.university_id', 'universities.id')
      .where({ 'closures.counselor_id': req.user.id })
      .whereIn('closures.final_status', ['lost', 'duplicate'])
      .select(
        'leads.*',
        'closures.drop_stage',
        'closures.drop_remark',
        'closures.final_status',
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

// Get counselor's job seeker leads
app.get('/api/counselor/leads/job-seekers', authenticateToken, requireRole(['counselor']), async (req, res) => {
  try {
    const jobSeekerLeads = await db('leads')
      .join('closures', 'leads.id', 'closures.lead_id')
      .leftJoin('universities', 'closures.university_id', 'universities.id')
      .where({
        'closures.counselor_id': req.user.id,
        'closures.final_status': 'job_seeker'
      })
      .select(
        'leads.*',
        'closures.drop_stage',
        'closures.drop_remark',
        'closures.final_status',
        'closures.closed_at',
        'universities.name as university_name'
      )
      .orderBy('closures.closed_at', 'desc');

    res.json(jobSeekerLeads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch job seeker leads' });
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

// Add a free-text remark with no status implication (replaces the old 'remark' outcome
// branch of the removed /action endpoint).
app.post('/api/counselor/leads/:id/note', authenticateToken, requireRole(['counselor']), async (req, res) => {
  const leadId = req.params.id;
  const { remark } = req.body;

  if (!remark || !remark.trim()) {
    return res.status(400).json({ error: 'A remark is required.' });
  }

  try {
    const assignment = await db('lead_assignments').where({ lead_id: leadId, counselor_id: req.user.id }).first();
    if (!assignment) {
      return res.status(404).json({ error: 'Access denied: You are not the owner of this lead.' });
    }
    // Same fix as the Log Call and status-change paths: a note is real activity on this
    // lead, so it should bump the "Last Updated" column on the Manager/Team Leader Daily
    // Tracker the same way those do — otherwise a lead only ever touched via a plain note
    // keeps showing whenever its status was last changed, ignoring the note entirely.
    // Wrapped in a transaction so the assignment bump and the activity-log entry either
    // both land or neither does — previously these were two independent statements, and an
    // error between them (or a mid-flight crash) could bump updated_at with no matching log
    // entry, or vice versa.
    await db.transaction(async (trx) => {
      await trx('lead_assignments').where({ lead_id: leadId }).update({ updated_at: new Date() });
      await logActivity(trx, leadId, req.user.id, 'note', remark);
    });
    res.json({ message: 'Remark added successfully.' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to add remark' });
  }
});

// Update a lead's flat counseling status — replaces the old disposition PUT and the
// tick/cross outcomes of the old /action endpoint (the whole L1/L2/L3 pipeline).
app.put('/api/counselor/leads/:id/status', authenticateToken, requireRole(['counselor']), async (req, res) => {
  const leadId = req.params.id;
  const {
    counselingStatus,
    notContactableReason,
    remark,
    universityId,
    courseDiscussed,
    leadType,
    existedUniversityId,
    leadTemperature,
    registrationStatus,
    registrationDate,
    feePaymentStatus,
    feeAmountPaid,
    feeTotalAmount,
    feeReminderDueAt,
    feeReminderNote,
    followUpDate
  } = req.body;

  if (!counselingStatus || !COUNSELING_STATUSES.includes(counselingStatus)) {
    return res.status(400).json({ error: `counselingStatus must be one of: ${COUNSELING_STATUSES.join(', ')}` });
  }

  if (counselingStatus === 'Call Back' && !followUpDate) {
    return res.status(400).json({ error: 'followUpDate is required for Call Back.' });
  }

  // A remark is mandatory on every status change — it's the only durable record of what
  // actually happened on the call, since the live counseling_status column just holds
  // the latest value and terminal updates delete the lead_assignments row entirely.
  if (!remark || !remark.trim()) {
    return res.status(400).json({ error: 'A remark is required to update the status.' });
  }

  if (counselingStatus === 'Not Contactable') {
    if (!notContactableReason || !NOT_CONTACTABLE_REASONS.includes(notContactableReason)) {
      return res.status(400).json({ error: `notContactableReason is required and must be one of: ${NOT_CONTACTABLE_REASONS.join(', ')}` });
    }
  }

  if ((counselingStatus === 'Lead Punched' || counselingStatus === 'Duplicate Lead') && !universityId) {
    return res.status(400).json({ error: 'universityId is required for Lead Punched / Duplicate Lead.' });
  }

  if (leadType !== undefined && leadType !== null && leadType !== '' && !LEAD_TYPES.includes(leadType)) {
    return res.status(400).json({ error: `leadType must be one of: ${LEAD_TYPES.join(', ')}` });
  }

  if (leadType === 'Existed' && !existedUniversityId) {
    return res.status(400).json({ error: 'existedUniversityId is required when leadType is Existed.' });
  }

  if (leadTemperature !== undefined && leadTemperature !== null && leadTemperature !== '' && !LEAD_TEMPERATURES.includes(leadTemperature)) {
    return res.status(400).json({ error: `leadTemperature must be one of: ${LEAD_TEMPERATURES.join(', ')}` });
  }

  if (counselingStatus === 'Lead Punched' && feePaymentStatus && !FEE_PAYMENT_STATUSES.includes(feePaymentStatus)) {
    return res.status(400).json({ error: `feePaymentStatus must be one of: ${FEE_PAYMENT_STATUSES.join(', ')}` });
  }

  if (counselingStatus === 'Lead Punched' && registrationStatus && !REGISTRATION_STATUSES.includes(registrationStatus)) {
    return res.status(400).json({ error: `registrationStatus must be one of: ${REGISTRATION_STATUSES.join(', ')}` });
  }

  try {
    await db.transaction(async (trx) => {
      const assignment = await trx('lead_assignments').where({ lead_id: leadId, counselor_id: req.user.id }).first();
      if (!assignment) {
        throw new Error('Access denied: You are not the owner of this lead.');
      }
      if (!assignment.locked) {
        throw new Error('This lead is not currently locked for counseling.');
      }
      // Block status changes while a lead is escalated to the manager — dropping/closing
      // a still-escalated lead would delete its lead_assignments row (where is_forwarded/
      // forward_remark/escalation_category live), permanently erasing the escalation with
      // no trace it ever happened and silently disappearing it from the manager's queue.
      if (assignment.is_forwarded) {
        throw new Error('This lead is escalated and awaiting manager review. It cannot be updated until the manager resolves the escalation.');
      }

      if (universityId !== undefined) {
        await trx('leads').where({ id: leadId }).update({ university_id: universityId || null, updated_at: new Date() });
      }
      if (courseDiscussed !== undefined) {
        await trx('leads').where({ id: leadId }).update({ course_interest: courseDiscussed || null, updated_at: new Date() });
      }
      if (leadType !== undefined) {
        await trx('leads').where({ id: leadId }).update({
          lead_type: leadType || null,
          existed_university_id: leadType === 'Existed' ? (existedUniversityId || null) : null,
          updated_at: new Date()
        });
      }
      if (leadTemperature !== undefined) {
        await trx('leads').where({ id: leadId }).update({ lead_temperature: leadTemperature || null, updated_at: new Date() });
      }

      const isTerminal = TERMINAL_STATUSES.includes(counselingStatus)
        || (counselingStatus === 'Lead Punched' && feePaymentStatus === 'Full');

      if (!isTerminal) {
        // Non-terminal: update in place, stays in the active pool (tomorrow's Carry
        // Forward if left untouched again).
        const updates = {
          counseling_status: counselingStatus,
          not_contactable_reason: counselingStatus === 'Not Contactable' ? notContactableReason : null,
          status_remark: remark || null,
          // Acting on the lead resolves whatever prompted it to show under "Escalation
          // Returns" — clear the flag so it drops off that list once handled. (Terminal
          // statuses don't need this: they delete the lead_assignments row entirely.)
          escalation_resolved_at: null,
          updated_at: new Date()
        };

        if (counselingStatus === 'Lead Punched') {
          updates.registration_status = registrationStatus || assignment.registration_status || 'Not Registered';
          updates.registration_date = registrationStatus === 'Registered'
            ? (registrationDate ? new Date(registrationDate) : (assignment.registration_date || new Date()))
            : null;
          updates.fee_payment_status = feePaymentStatus || assignment.fee_payment_status || 'None';
          updates.fee_amount_paid = feeAmountPaid !== undefined ? parseFloat(feeAmountPaid || 0) : assignment.fee_amount_paid;
          updates.fee_total_amount = feeTotalAmount !== undefined ? parseFloat(feeTotalAmount || 0) : assignment.fee_total_amount;
          updates.fee_reminder_note = feeReminderNote !== undefined ? feeReminderNote : assignment.fee_reminder_note;
          if (updates.fee_payment_status === 'Partial' || updates.fee_payment_status === 'Full') {
            if (feeReminderDueAt) {
              updates.fee_reminder_due_at = new Date(feeReminderDueAt);
            } else if (!assignment.fee_reminder_due_at) {
              const due = new Date();
              due.setDate(due.getDate() + DEFAULT_FEE_REMINDER_DAYS);
              updates.fee_reminder_due_at = due;
            }
          }
        }

        await trx('lead_assignments').where({ lead_id: leadId }).update(updates);

        const statusLogSuffix = counselingStatus === 'Not Contactable' ? ` (${notContactableReason})` : '';
        const remarkSuffix = remark ? ` — ${remark}` : '';
        await logActivity(trx, leadId, req.user.id, 'status_change', `${STATUS_LOG_PREFIX}${counselingStatus}${statusLogSuffix}${remarkSuffix}`);

        if (counselingStatus === 'Lead Punched' && registrationStatus === 'Registered' && assignment.registration_status !== 'Registered') {
          await logActivity(trx, leadId, req.user.id, 'registration_update', `Registered${universityId ? '' : ''}${remark ? ` — ${remark}` : ''}`);
        }
        if (counselingStatus === 'Lead Punched' && feePaymentStatus && feePaymentStatus !== assignment.fee_payment_status) {
          await logActivity(trx, leadId, req.user.id, 'fee_update', `Fee payment status changed to: ${feePaymentStatus}${feeAmountPaid ? ` (₹${feeAmountPaid})` : ''}`);
        }

        // Call Back schedules the next call the same way the dedicated /follow-up
        // endpoint does — completes any still-open follow-up for this lead first so a
        // repeated Call Back doesn't pile up multiple "due" reminders for the same lead.
        if (counselingStatus === 'Call Back' && followUpDate) {
          await trx('follow_ups')
            .where({ lead_id: leadId, counselor_id: req.user.id, completed: false })
            .update({ completed: true, completed_at: new Date() });
          await trx('follow_ups').insert({
            id: randomUUID(),
            lead_id: leadId,
            counselor_id: req.user.id,
            follow_up_date: new Date(followUpDate),
            notes: remark,
            completed: false,
            created_at: new Date()
          });
        }
        return;
      }

      // Terminal: upsert a closures row (mirrors the old cross/enrollment pattern) and
      // delete the active assignment.
      const finalStatus = counselingStatus === 'Lead Punched' ? 'enrolled' : (
        counselingStatus === 'Not Interested' ? 'lost' :
          counselingStatus === 'Duplicate Lead' ? 'duplicate' : 'job_seeker'
      );
      const isEnrolled = finalStatus === 'enrolled';
      const revenueAmount = isEnrolled ? parseFloat(feeAmountPaid || feeTotalAmount || 0) : 0;

      const existingClosure = await trx('closures').where({ lead_id: leadId }).first();
      const closurePayload = {
        university_id: universityId || (existingClosure ? existingClosure.university_id : null),
        application_status: isEnrolled ? 'Approved' : 'rejected',
        final_status: finalStatus,
        revenue: revenueAmount,
        counselor_id: req.user.id,
        drop_stage: counselingStatus,
        drop_remark: remark,
        closed_at: new Date(),
        // Preserves whether this lead was Carry Forward or Fresh at the moment it closed —
        // the assignment row is about to be deleted below, so this is the only place left
        // to capture it for the CF Ahead/Pending reporting split.
        assignment_assigned_at: assignment.assigned_at
      };
      if (existingClosure) {
        await trx('closures').where({ lead_id: leadId }).update(closurePayload);
      } else {
        await trx('closures').insert({
          id: randomUUID(),
          lead_id: leadId,
          documents_status: JSON.stringify({}),
          created_at: new Date(),
          ...closurePayload
        });
      }

      await trx('leads').where({ id: leadId }).update({
        status: isEnrolled ? 'enrolled' : (counselingStatus === 'Duplicate Lead' ? 'duplicate' : 'closed'),
        updated_at: new Date()
      });

      await trx('lead_assignments').where({ lead_id: leadId }).delete();

      // Closing the lead out entirely — any still-open follow-up (e.g. a previously
      // scheduled Call Back) is now moot; leaving it incomplete would keep inflating the
      // "due follow-ups" count with a lead that's no longer even in the active pool.
      await trx('follow_ups')
        .where({ lead_id: leadId, completed: false })
        .update({ completed: true, completed_at: new Date() });

      const logAction = isEnrolled ? 'tick' : 'cross';
      const logRemark = isEnrolled
        ? `Successfully closed lead: Enrolled (Fee Full, ₹${revenueAmount})`
        : `Closed/Lost: ${counselingStatus}${remark ? ` — ${remark}` : ''}`;
      await logActivity(trx, leadId, req.user.id, logAction, logRemark);
    });

    res.json({ message: 'Status updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to update status' });
  }
});

// GET /api/leads/:id/remarks — full remarks history for a lead (every status change,
// note, registration/fee update, forward, and final outcome that carried a remark),
// newest first. Used by every dashboard's "view remarks" detail panel since a lead can
// accumulate several remarks over time and the live lead_assignments.status_remark
// column only ever holds the latest one.
app.get('/api/leads/:id/remarks', authenticateToken, requireRole(['counselor', 'manager', 'team_leader', 'super_admin']), async (req, res) => {
  const leadId = req.params.id;
  try {
    if (req.user.role === 'counselor') {
      const assignment = await db('lead_assignments').where({ lead_id: leadId, counselor_id: req.user.id }).first();
      const closure = await db('closures').where({ lead_id: leadId, counselor_id: req.user.id }).first();
      if (!assignment && !closure) {
        return res.status(403).json({ error: 'Access denied: You do not own this lead.' });
      }
    }

    let query = db('lead_activity_log')
      .join('users', 'lead_activity_log.counselor_id', 'users.id')
      .where('lead_activity_log.lead_id', leadId)
      .whereNotNull('lead_activity_log.remark');

    if (req.user.role === 'team_leader') {
      if (!req.user.team_id) return res.json([]);
      query = query.where('users.team_id', req.user.team_id);
    }

    const remarks = await query
      .select(
        'lead_activity_log.id',
        'lead_activity_log.action',
        'lead_activity_log.remark',
        'lead_activity_log.timestamp',
        'users.name as counselor_name'
      )
      .orderBy('lead_activity_log.timestamp', 'desc');

    res.json(remarks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch remarks history' });
  }
});

// Log call notes and schedule next follow-up date (L2)
app.post('/api/counselor/leads/:id/follow-up', authenticateToken, requireRole(['counselor']), async (req, res) => {
  const leadId = req.params.id;
  const { followUpDate, notes, universityDiscussed, courseDiscussed, feeDiscussed, universityId } = req.body;

  if (!notes || !notes.trim()) {
    return res.status(400).json({ error: 'Call notes are required.' });
  }

  try {
    await db.transaction(async (trx) => {
      // 1. Verify owner
      const assignment = await trx('lead_assignments').where({ lead_id: leadId, counselor_id: req.user.id }).first();
      if (!assignment) {
        throw new Error('Access denied: You do not own this lead.');
      }

      // A call was just logged against this assignment — bump its updated_at the same way
      // a status change does. Without this, the "Last Updated" column on the Manager/Team
      // Leader Daily Tracker (and anything else keying off lead_assignments.updated_at)
      // kept showing whenever the status was last changed, silently ignoring every call
      // logged through this endpoint in between.
      await trx('lead_assignments').where({ lead_id: leadId }).update({ updated_at: new Date() });

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
  const { period } = req.query; // 'today' | 'week' | 'month' | omitted = all-time
  try {
    // 1. Data Report (Fresh/Carry Forward/Touched) for this counselor, self-scoped.
    const dataReport = await computeDataReport(db, { counselorIds: [req.user.id] });
    const myReport = dataReport.perCounselor[0] || { openingCF: 0, freshBase: 0, totalBase: 0, touchedBase: 0, touchPct: 0 };

    // 2. Closures (Enrolled vs Lost)
    // Filter directly on closures.counselor_id — a lead dropped straight from L1 never
    // gets a 'tick' activity log, so inferring ownership through that log silently
    // excluded those drops from the counselor's own stats.
    const closuresSummary = await db('closures')
      .where({ counselor_id: req.user.id })
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
    const currentMonth = getCurrentMonthKeyIST(); // e.g. "2026-07"
    const targetRecord = await db('targets')
      .where({ counselor_id: req.user.id, target_month: currentMonth })
      .first();
    const monthlyTarget = targetRecord ? targetRecord.target_count : 10; // default target is 10

    // IST midnight on the 1st of currentMonth, as an absolute instant — NOT
    // `new Date(); setDate(1); setHours(0,0,0,0)`, which depends on the server process's
    // local timezone (ambiguous across dev/production) and could disagree with
    // currentMonth's IST-based bucket near either month boundary.
    const startOfMonth = new Date(`${currentMonth}-01T00:00:00+05:30`);

    const monthlyEnrolledRecord = await db('closures')
      .where({ counselor_id: req.user.id, final_status: 'enrolled' })
      .andWhere('closed_at', '>=', serializeDate(startOfMonth))
      .count('id as count')
      .first();

    const monthlyEnrolledCount = parseInt(monthlyEnrolledRecord.count || 0, 10);
    const targetLeft = Math.max(0, monthlyTarget - monthlyEnrolledCount);

    // 5. Data Status (L1) breakdown — sourced from confirmed 'status_change' log entries
    // rather than the live counseling_status column, so drops don't erase history and a
    // daily/weekly/monthly breakdown is actually possible.
    const periodRange = getPeriodRange(period);
    let statusLogQuery = db('lead_activity_log')
      .where({ counselor_id: req.user.id, action: 'status_change' });
    if (periodRange) {
      statusLogQuery = statusLogQuery
        .where('timestamp', '>=', serializeDate(periodRange.start))
        .where('timestamp', '<=', serializeDate(periodRange.end));
    }
    const statusLogs = await statusLogQuery.select('lead_id', 'action', 'remark', 'timestamp');
    const statusSummary = computeStatusSummary(statusLogs);

    res.json({
      dataReport: myReport,
      enrolledCount,
      lostCount,
      totalRevenue,
      completedFollowups: parseInt(completedFollowups.count || 0, 10),
      pendingFollowups: parseInt(pendingFollowups.count || 0, 10),
      monthlyTarget,
      monthlyEnrolledCount,
      targetLeft,
      statusSummary
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
    // Reconstruct each date's counts from that day's actual status, not today's — see
    // reconstructDailyStatusStates() for why the previous "join current live state"
    // approach retroactively rewrote a lead's earlier history to match its final outcome.
    const logs = await db('lead_activity_log')
      .where({ counselor_id: req.user.id })
      .whereNotNull('lead_id')
      // Exclude 'distributed' — reconstructDailyStatusStates stamps a 'Not Contacted' entry
      // for ANY log row regardless of action, so without this, a lead auto-logged as
      // distributed on a given day counted as "worked" that day even with zero real activity.
      .whereNot('action', 'distributed')
      .select('lead_id', 'action', 'remark', 'timestamp');

    if (logs.length === 0) {
      return res.json([]);
    }

    const dateStateMap = reconstructDailyStatusStates(logs);

    // Keyed by the raw counseling_status string (e.g. group['Lead Punched']) rather than
    // a fixed camelCase field list, so the frontend can render whatever statuses actually
    // occurred that day via Object.entries() without both sides needing to stay in sync.
    const dateGroups = Object.entries(dateStateMap).map(([dateStr, leadStates]) => {
      const group = { date: dateStr, total: 0 };
      Object.values(leadStates).forEach(status => {
        group.total++;
        group[status] = (group[status] || 0) + 1;
      });
      return group;
    });

    const result = dateGroups.sort((a, b) => b.date.localeCompare(a.date));
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
    // Need the counselor's FULL activity history (not just this date) to correctly
    // replay each lead's status up through the end of the requested date — see
    // reconstructDailyStatusStates() for why using current live status here would
    // retroactively rewrite this date's history to match a later outcome.
    const logs = await db('lead_activity_log')
      .where({ counselor_id: req.user.id })
      .whereNotNull('lead_id')
      // Exclude 'distributed' — reconstructDailyStatusStates stamps a 'Not Contacted' entry
      // for ANY log row regardless of action, so without this, a lead auto-logged as
      // distributed on a given day counted as "worked" that day even with zero real activity.
      .whereNot('action', 'distributed')
      .select('lead_id', 'action', 'remark', 'timestamp');

    const dateStateMap = reconstructDailyStatusStates(logs);
    const leadStatesForDate = dateStateMap[date] || {};
    const leadIds = Object.keys(leadStatesForDate);

    if (leadIds.length === 0) {
      return res.json({ summary: { total: 0 }, leads: [] });
    }

    const leadsData = await db('leads')
      .whereIn('leads.id', leadIds)
      .leftJoin('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .leftJoin('closures', 'leads.id', 'closures.lead_id')
      .leftJoin('universities', 'closures.university_id', 'universities.id')
      .select(
        'leads.*',
        'closures.revenue as closure_revenue',
        'universities.name as closure_university'
      )
      .orderBy('leads.created_at', 'desc');

    const summary = { total: leadsData.length };
    leadsData.forEach(l => {
      const status = leadStatesForDate[l.id]; // as of this date
      summary[status] = (summary[status] || 0) + 1;
      l.counseling_status = status;
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

        // Insert new assignment — a transfer is a change of OWNER, not a reset of the
        // lead's actual progress. Carrying counseling_status/registration/fee state
        // forward from the old assignment avoids a lead already marked Lead Punched
        // (with real work behind it — university interest, registration, partial fee)
        // silently resetting to Not Contacted on transfer. assigned_at is bumped to now
        // so the new counselor correctly sees this as their Fresh Base today.
        await trx('lead_assignments').insert({
          id: randomUUID(),
          lead_id: request.lead_id,
          counselor_id: finalTarget,
          assigned_by: req.user.id,
          assigned_at: new Date(),
          stage: currentAssign ? currentAssign.stage : 'L1',
          disposition: currentAssign ? currentAssign.disposition : 'None',
          counseling_status: currentAssign ? currentAssign.counseling_status : 'Not Contacted',
          not_contactable_reason: currentAssign ? currentAssign.not_contactable_reason : null,
          registration_status: currentAssign ? currentAssign.registration_status : 'Not Registered',
          registration_date: currentAssign ? currentAssign.registration_date : null,
          fee_payment_status: currentAssign ? currentAssign.fee_payment_status : 'None',
          fee_amount_paid: currentAssign ? currentAssign.fee_amount_paid : null,
          fee_total_amount: currentAssign ? currentAssign.fee_total_amount : null,
          fee_reminder_due_at: currentAssign ? currentAssign.fee_reminder_due_at : null,
          fee_reminder_note: currentAssign ? currentAssign.fee_reminder_note : null,
          locked: true,
          updated_at: new Date()
        });

        // Carry any still-open follow-up (e.g. a scheduled Call Back) over to the new
        // owner. Without this it stays attributed to the old counselor_id — invisible to
        // the new owner (who now owns the lead) while still counting as "due" for the old
        // owner (who no longer does), even though the callback itself is still legitimate.
        if (oldOwnerId) {
          await trx('follow_ups')
            .where({ lead_id: request.lead_id, counselor_id: oldOwnerId, completed: false })
            .update({ counselor_id: finalTarget });
        }

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
  const { batch_id, counselingStatus, status, source } = req.query;

  try {
    // Counselor name falls back to closures.counselor_id — dropping a lead deletes its
    // lead_assignments row, so relying on that join alone leaves every dropped lead's
    // counselor blank.
    let query = db('leads')
      .leftJoin('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .leftJoin('users as counselors', 'lead_assignments.counselor_id', 'counselors.id')
      .leftJoin('closures', 'leads.id', 'closures.lead_id')
      .leftJoin('users as closure_counselors', 'closures.counselor_id', 'closure_counselors.id')
      .leftJoin('universities', 'leads.university_id', 'universities.id');

    if (req.user.role === 'team_leader') {
      if (!req.user.team_id) {
        return res.json([]);
      }
      // Filtering directly on the left-joined 'counselors.team_id' would silently turn
      // this into an inner join — any lead with no CURRENT assignment (i.e. every dropped
      // lead) has counselors.team_id = NULL, which never matches and gets excluded even
      // though it belongs to this team via closures.counselor_id. Scope by team membership
      // instead, checked against either source of counselor attribution.
      const teamCounselorIds = db('users').where({ team_id: req.user.team_id, role: 'counselor' }).select('id');
      query = query.where(function () {
        this.whereIn('lead_assignments.counselor_id', teamCounselorIds)
          .orWhereIn('closures.counselor_id', teamCounselorIds);
      });
    }

    query = query.select(
      'leads.*',
      'lead_assignments.counseling_status',
      'lead_assignments.not_contactable_reason',
      'lead_assignments.status_remark',
      'lead_assignments.registration_status',
      'lead_assignments.fee_payment_status',
      'lead_assignments.fee_amount_paid',
      'lead_assignments.fee_total_amount',
      'lead_assignments.fee_reminder_due_at',
      'lead_assignments.locked',
      db.raw('COALESCE(counselors.name, closure_counselors.name) as counselor_name'),
      'universities.name as university_name'
    );

    if (batch_id) {
      query = query.where({ 'leads.upload_batch_id': batch_id });
    }

    if (counselingStatus) {
      query = query.where({ 'lead_assignments.counseling_status': counselingStatus });
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
      // Checked via lead_assignments (currently active leads) OR closures.counselor_id
      // (enrolled/dropped leads) — dropping or enrolling a lead deletes its
      // lead_assignments row, so the assignment-only check would deny access to a
      // team leader's own team's history the moment a lead is closed either way.
      const assigned = await db('lead_assignments')
        .join('users', 'lead_assignments.counselor_id', 'users.id')
        .where({ 'lead_assignments.lead_id': leadId, 'users.team_id': req.user.team_id })
        .first();
      const closedByTeam = assigned ? null : await db('closures')
        .join('users', 'closures.counselor_id', 'users.id')
        .where({ 'closures.lead_id': leadId, 'users.team_id': req.user.team_id })
        .first();
      if (!assigned && !closedByTeam) {
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

// Data Report: Opening CF / Fresh Base / Total Base / Touched Base / Touch%, per
// counselor + aggregate. Replaces the old L1/L2/L3 pipeline funnel.
app.get('/api/reports/data-report', authenticateToken, requireRole(['super_admin', 'manager', 'team_leader']), async (req, res) => {
  try {
    if (req.user.role === 'team_leader' && !req.user.team_id) {
      return res.json({ perCounselor: [], aggregate: { openingCF: 0, freshBase: 0, totalBase: 0, touchedBase: 0, touchPct: 0 } });
    }
    const scope = req.user.role === 'team_leader' ? { teamId: req.user.team_id } : {};
    const report = await computeDataReport(db, scope);
    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch data report' });
  }
});

// Data Status (L1): counts by the 6 flat statuses + Not Contactable sub-reasons +
// Lead Punched registration/fee breakdown + closures summary. Replaces the old
// stage/disposition-based /api/reports/pipeline.
app.get('/api/reports/data-status', authenticateToken, requireRole(['super_admin', 'manager', 'team_leader']), async (req, res) => {
  try {
    let statusQuery = db('lead_assignments');
    let notContactableQuery = db('lead_assignments').where({ counseling_status: 'Not Contactable' });
    let punchedQuery = db('lead_assignments').where({ counseling_status: 'Lead Punched' });
    let closuresQuery = db('closures');
    let temperatureQuery = db('leads').join('lead_assignments', 'leads.id', 'lead_assignments.lead_id');
    let unassignedRoleBlocked = false;

    if (req.user.role === 'team_leader') {
      if (!req.user.team_id) {
        return res.json({
          statusCounts: [], notContactableBreakdown: [], leadPunchedBreakdown: { registrationStatus: [], feePaymentStatus: [] },
          unassigned: 0, closuresSummary: [], leadTemperatureBreakdown: []
        });
      }
      statusQuery = statusQuery.join('users', 'lead_assignments.counselor_id', 'users.id').where('users.team_id', req.user.team_id);
      notContactableQuery = notContactableQuery.join('users', 'lead_assignments.counselor_id', 'users.id').where('users.team_id', req.user.team_id);
      punchedQuery = punchedQuery.join('users', 'lead_assignments.counselor_id', 'users.id').where('users.team_id', req.user.team_id);
      closuresQuery = closuresQuery.whereIn('closures.counselor_id', db('users').where({ team_id: req.user.team_id }).select('id'));
      temperatureQuery = temperatureQuery.join('users', 'lead_assignments.counselor_id', 'users.id').where('users.team_id', req.user.team_id);
      unassignedRoleBlocked = true;
    }

    const statusCounts = await statusQuery
      .groupBy('lead_assignments.counseling_status')
      .select('lead_assignments.counseling_status')
      .count('lead_assignments.id as count');

    const notContactableBreakdown = await notContactableQuery
      .groupBy('lead_assignments.not_contactable_reason')
      .select('lead_assignments.not_contactable_reason')
      .count('lead_assignments.id as count');

    const registrationBreakdown = await punchedQuery.clone()
      .groupBy('lead_assignments.registration_status')
      .select('lead_assignments.registration_status')
      .count('lead_assignments.id as count');

    const feeBreakdown = await punchedQuery.clone()
      .groupBy('lead_assignments.fee_payment_status')
      .select('lead_assignments.fee_payment_status')
      .count('lead_assignments.id as count');

    const closuresSummary = await closuresQuery
      .groupBy('closures.final_status')
      .select('closures.final_status')
      .count('closures.id as count')
      .sum('closures.revenue as total_revenue');

    // Hot/Warm/Cold intent classification on currently active Interested/Lead
    // Punched/Duplicate Lead leads — distinct from the 'Cold' counseling_status above,
    // which is about contact-ability, not sales intent.
    const leadTemperatureBreakdown = await temperatureQuery
      .whereNotNull('leads.lead_temperature')
      .groupBy('leads.lead_temperature')
      .select('leads.lead_temperature')
      .count('leads.id as count');

    const unassignedCount = unassignedRoleBlocked ? { count: 0 } : await db('leads')
      .leftJoin('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .where({ 'leads.status': 'clean' })
      .whereNull('lead_assignments.id')
      .count('leads.id as count')
      .first();

    res.json({
      statusCounts,
      notContactableBreakdown,
      leadPunchedBreakdown: { registrationStatus: registrationBreakdown, feePaymentStatus: feeBreakdown },
      unassigned: parseInt(unassignedCount.count || 0, 10),
      closuresSummary,
      leadTemperatureBreakdown
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch data status report' });
  }
});

// Counselor Leaderboard — Data Report fields (Opening CF/Fresh/Total/Touched/Touch%)
// plus enrolled/lost/revenue per counselor.
app.get('/api/reports/counselor-leaderboard', authenticateToken, requireRole(['super_admin', 'manager', 'team_leader']), async (req, res) => {
  try {
    if (req.user.role === 'team_leader' && !req.user.team_id) {
      return res.json([]);
    }
    const scope = req.user.role === 'team_leader' ? { teamId: req.user.team_id } : {};
    const { perCounselor } = await computeDataReport(db, scope);

    // Attribute closures directly via closures.counselor_id (set whenever a closure is
    // created/updated) rather than inferring it through activity logs — a lead dropped
    // straight from a non-terminal status never gets a 'tick' log, so joining through
    // that log silently dropped it from the leaderboard even though it's a real closure.
    let closuresQuery = db('closures')
      .join('users', 'closures.counselor_id', 'users.id')
      .groupBy('closures.counselor_id', 'users.name', 'closures.final_status')
      .select('closures.counselor_id', 'users.name as counselor_name', 'closures.final_status')
      .count('closures.id as cnt')
      .sum('closures.revenue as total_revenue');

    if (req.user.role === 'team_leader') {
      closuresQuery = closuresQuery.where({ 'users.team_id': req.user.team_id });
    }
    const closures = await closuresQuery;

    const counselorMap = {};
    perCounselor.forEach(c => {
      counselorMap[c.id] = { ...c, enrolled: 0, lost: 0, revenue: 0 };
    });

    closures.forEach(c => {
      if (!counselorMap[c.counselor_id]) {
        counselorMap[c.counselor_id] = { id: c.counselor_id, name: c.counselor_name, openingCF: 0, freshBase: 0, totalBase: 0, touchedBase: 0, touchPct: 0, enrolled: 0, lost: 0, revenue: 0 };
      }
      if (c.final_status === 'enrolled') {
        counselorMap[c.counselor_id].enrolled = parseInt(c.cnt, 10);
        counselorMap[c.counselor_id].revenue = parseFloat(c.total_revenue || 0);
      } else if (c.final_status === 'lost') {
        counselorMap[c.counselor_id].lost = parseInt(c.cnt, 10);
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
    // Grouping done in JS (by IST calendar day, consistent with the rest of the app's
    // date handling) rather than in SQL, since `date('now', '-14 days')`/`date(col)` are
    // SQLite-only syntax and would throw on the production PostgreSQL database.
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const rows = await db('upload_batches')
      .where('upload_date', '>=', serializeDate(fourteenDaysAgo))
      .select('upload_date', 'total_rows', 'clean_rows');

    const byDate = {};
    rows.forEach(r => {
      const dateStr = getISTDateString(new Date(r.upload_date));
      if (!byDate[dateStr]) byDate[dateStr] = { date: dateStr, total: 0, clean: 0 };
      byDate[dateStr].total += Number(r.total_rows) || 0;
      byDate[dateStr].clean += Number(r.clean_rows) || 0;
    });

    const trend = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
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

  // IST calendar dates (as picked in the UI), not UTC — see getISTDayRange.
  const start = getISTDayRange(start_date).start;
  const end = getISTDayRange(end_date).end;

  try {
    // 1. Batches uploaded in this range
    let batches = [];
    if (req.user.role !== 'team_leader') {
      batches = await db('upload_batches')
        .leftJoin('users', 'upload_batches.uploaded_by', 'users.id')
        .where('upload_batches.upload_date', '>=', serializeDate(start))
        .where('upload_batches.upload_date', '<=', serializeDate(end))
        .select('upload_batches.*', 'users.name as uploader_name')
        .orderBy('upload_batches.upload_date', 'desc');
    }

    // 2. Summary stats for leads created in this range
    let leadsSummaryQuery = db('leads')
      .where('leads.created_at', '>=', serializeDate(start))
      .where('leads.created_at', '<=', serializeDate(end));
    if (req.user.role === 'team_leader') {
      if (!req.user.team_id) {
        return res.json({
          summary: { total_uploaded: 0, clean_rows: 0, duplicate_rows: 0, invalid_rows: 0, total_distributed: 0, enrolled: 0, lost: 0, revenue: 0 },
          batches: [],
          counselors: []
        });
      }
      // Filtering directly on a joined 'counselors.team_id' would turn this into an inner
      // join and silently exclude every dropped lead (no current lead_assignments row) even
      // though it belongs to this team via closures.counselor_id. Scope by team membership
      // checked against either source of attribution instead.
      const teamCounselorIds = db('users').where({ team_id: req.user.team_id, role: 'counselor' }).select('id');
      leadsSummaryQuery = leadsSummaryQuery
        .leftJoin('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
        .leftJoin('closures', 'leads.id', 'closures.lead_id')
        .where(function () {
          this.whereIn('lead_assignments.counselor_id', teamCounselorIds)
            .orWhereIn('closures.counselor_id', teamCounselorIds);
        });
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
    // Sourced from the permanent 'distributed' activity log entry, not the live
    // lead_assignments row — that row gets deleted the moment a lead is later dropped
    // OR enrolled, which would make "leads distributed in this range" shrink over time
    // as leads get closed, even though the distribution itself is a historical fact that
    // never changes. This was silently deflating total_distributed, which is exactly what
    // let the enrolled/lost conversion rate (computed against this same denominator)
    // read over 100% once enough previously-distributed leads had since closed.
    let distQuery = db('lead_activity_log')
      .join('users', 'lead_activity_log.counselor_id', 'users.id')
      .where('lead_activity_log.action', 'distributed')
      .where('lead_activity_log.timestamp', '>=', serializeDate(start))
      .where('lead_activity_log.timestamp', '<=', serializeDate(end));
    if (req.user.role === 'team_leader') {
      distQuery = distQuery.where({ 'users.team_id': req.user.team_id });
    }

    const distributedCount = await distQuery
      .count('lead_activity_log.id as count')
      .first();

    // 4. Closures summary in this range
    let closuresSumQuery = db('closures')
      .where('closures.closed_at', '>=', serializeDate(start))
      .where('closures.closed_at', '<=', serializeDate(end));
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
        // 'lost'/'duplicate'/'job_seeker' are all counted together as "Drops" here —
        // must match the per-counselor breakdown below (counselorClosures.forEach),
        // which already combines all three under counselorMap[...].lost. Counting only
        // 'lost' here made the summary card's Drops figure disagree with the sum of the
        // per-counselor table's Lost/Dropped column whenever any Duplicate/Job Seeker
        // closures fell in the date range.
      } else if (c.final_status === 'lost' || c.final_status === 'duplicate' || c.final_status === 'job_seeker') {
        lostCount += count;
      }
    });

    // 5. Counselor-wise allocation and conversions in this range
    let counselorAllocationsQuery = db('lead_assignments')
      .join('users', 'lead_assignments.counselor_id', 'users.id')
      .where('lead_assignments.assigned_at', '>=', serializeDate(start))
      .where('lead_assignments.assigned_at', '<=', serializeDate(end));

    // Attribute closures directly via closures.counselor_id — a lead dropped straight
    // from L1 never gets a 'tick' activity log, so joining through that log silently
    // excluded those drops from this report even though they're real closures.
    let counselorClosuresQuery = db('closures')
      .join('users', 'closures.counselor_id', 'users.id')
      .where('closures.closed_at', '>=', serializeDate(start))
      .where('closures.closed_at', '<=', serializeDate(end));

    if (req.user.role === 'team_leader') {
      counselorAllocationsQuery = counselorAllocationsQuery.where({ 'users.team_id': req.user.team_id });
      counselorClosuresQuery = counselorClosuresQuery.where({ 'users.team_id': req.user.team_id });
    }

    const counselorAllocations = await counselorAllocationsQuery
      .groupBy('lead_assignments.counselor_id', 'users.name', 'lead_assignments.counseling_status')
      .select('lead_assignments.counselor_id', 'users.name as counselor_name', 'lead_assignments.counseling_status')
      .count('lead_assignments.id as cnt');

    const counselorClosures = await counselorClosuresQuery
      .groupBy('closures.counselor_id', 'users.name', 'closures.final_status')
      .select('closures.counselor_id', 'users.name as counselor_name', 'closures.final_status')
      .count('closures.id as cnt')
      .sum('closures.revenue as total_revenue');

    const counselorMap = {};
    const emptyCounts = () => ({ notContacted: 0, interested: 0, callBack: 0, cold: 0, notContactable: 0, leadPunched: 0, enrolled: 0, lost: 0, revenue: 0 });
    const statusKeys = { 'Not Contacted': 'notContacted', 'Interested': 'interested', 'Call Back': 'callBack', 'Cold': 'cold', 'Not Contactable': 'notContactable', 'Lead Punched': 'leadPunched' };
    counselorAllocations.forEach(r => {
      if (!counselorMap[r.counselor_id]) {
        counselorMap[r.counselor_id] = { id: r.counselor_id, name: r.counselor_name, ...emptyCounts() };
      }
      const key = statusKeys[r.counseling_status];
      if (key) counselorMap[r.counselor_id][key] = parseInt(r.cnt, 10);
    });

    counselorClosures.forEach(c => {
      if (!counselorMap[c.counselor_id]) {
        counselorMap[c.counselor_id] = { id: c.counselor_id, name: c.counselor_name, ...emptyCounts() };
      }
      if (c.final_status === 'enrolled') {
        counselorMap[c.counselor_id].enrolled = parseInt(c.cnt, 10);
        counselorMap[c.counselor_id].revenue = parseFloat(c.total_revenue || 0);
      } else if (c.final_status === 'lost' || c.final_status === 'duplicate' || c.final_status === 'job_seeker') {
        counselorMap[c.counselor_id].lost += parseInt(c.cnt, 10);
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

  // IST calendar dates (as picked in the UI), not UTC — see getISTDayRange.
  const start = getISTDayRange(start_date).start;
  const end = getISTDayRange(end_date).end;

  try {
    // Counselor name falls back to closures.counselor_id — dropping a lead deletes its
    // lead_assignments row, so relying on that join alone leaves every dropped lead's
    // counselor blank here.
    let query = db('leads')
      .leftJoin('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .leftJoin('users as counselors', 'lead_assignments.counselor_id', 'counselors.id')
      .leftJoin('closures', 'leads.id', 'closures.lead_id')
      .leftJoin('users as closure_counselors', 'closures.counselor_id', 'closure_counselors.id')
      .leftJoin('universities', 'leads.university_id', 'universities.id')
      .leftJoin('upload_batches', 'leads.upload_batch_id', 'upload_batches.id')
      .where('leads.created_at', '>=', serializeDate(start))
      .where('leads.created_at', '<=', serializeDate(end));

    if (req.user.role === 'team_leader') {
      if (!req.user.team_id) {
        return res.json([]);
      }
      // Filtering directly on 'counselors.team_id' would turn this into an inner join and
      // exclude every dropped lead (no current assignment). Scope by team membership
      // checked against either source of counselor attribution instead.
      const teamCounselorIds = db('users').where({ team_id: req.user.team_id, role: 'counselor' }).select('id');
      query = query.where(function () {
        this.whereIn('lead_assignments.counselor_id', teamCounselorIds)
          .orWhereIn('closures.counselor_id', teamCounselorIds);
      });
    }

    query = query.select(
      'leads.*',
      'upload_batches.file_name as batch_name',
      'lead_assignments.counseling_status',
      'lead_assignments.not_contactable_reason',
      'lead_assignments.status_remark',
      'lead_assignments.registration_status',
      'lead_assignments.fee_payment_status',
      db.raw('COALESCE(counselors.name, closure_counselors.name) as counselor_name'),
      'closures.final_status as closure_status',
      'closures.revenue as closure_revenue',
      'closures.drop_remark as closure_remark',
      'universities.name as university_name'
    );

    if (search) {
      const q = `%${search.toLowerCase()}%`;
      query = query.where(function () {
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

  // IST calendar dates (as picked in the UI), not UTC — see getISTDayRange.
  const start = getISTDayRange(start_date).start;
  const end = getISTDayRange(end_date).end;

  try {
    // Assigned Counselor falls back to closures.counselor_id — dropping a lead deletes
    // its lead_assignments row, so relying on that join alone leaves every dropped lead's
    // counselor blank in the exported file.
    const leads = await db('leads')
      .leftJoin('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .leftJoin('users as counselors', 'lead_assignments.counselor_id', 'counselors.id')
      .leftJoin('closures', 'leads.id', 'closures.lead_id')
      .leftJoin('users as closure_counselors', 'closures.counselor_id', 'closure_counselors.id')
      .leftJoin('universities', 'leads.university_id', 'universities.id')
      .leftJoin('upload_batches', 'leads.upload_batch_id', 'upload_batches.id')
      .where('leads.created_at', '>=', serializeDate(start))
      .where('leads.created_at', '<=', serializeDate(end))
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
        db.raw('COALESCE(counselors.name, closure_counselors.name) as "Assigned Counselor"'),
        'lead_assignments.counseling_status as Counseling Status',
        'leads.status as Data Status',
        'closures.final_status as Closure Outcome',
        'closures.revenue as Revenue',
        'leads.created_at as Upload Date'
      )
      .orderBy('leads.created_at', 'asc');

    // Log the download event — every other export endpoint in this file does this
    // (export/batch/:batchId, export/all); this one was silently missing it, leaving no
    // audit trail for a custom-timeline export despite the PRD's "every export is logged"
    // requirement.
    await db('lead_activity_log').insert({
      id: randomUUID(),
      lead_id: null,
      counselor_id: req.user.id,
      action: 'download',
      remark: `Downloaded custom timeline export: ${start_date} to ${end_date} (${leads.length} leads)`,
      timestamp: new Date()
    });

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(sanitizeForExport(leads));
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
      query = query.where('lead_activity_log.timestamp', '>=', serializeDate(new Date(start_date)));
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
      // Filter by IST calendar day (date = YYYY-MM-DD), via getISTDayRange like every other
      // date-bounded report in this file. The previous `DATE(upload_batches.upload_date) = ?`
      // read the UTC date on Postgres (wrong by up to 5.5h around IST midnight), and on SQLite
      // treated the stored epoch-ms integer as a Julian day number (DATE() needs an
      // `unixepoch` modifier for that), so the filter matched nothing at all in dev.
      const { start, end } = getISTDayRange(date);
      batchQuery = batchQuery
        .where('upload_batches.upload_date', '>=', serializeDate(start))
        .where('upload_batches.upload_date', '<=', serializeDate(end));
    }

    const batches = await batchQuery;

    if (batches.length === 0) {
      return res.json([]);
    }

    const batchIds = batches.map(b => b.id);

    // Counseling status counts per batch — join leads → lead_assignments
    const statusCounts = await db('leads')
      .join('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .whereIn('leads.upload_batch_id', batchIds)
      .groupBy('leads.upload_batch_id', 'lead_assignments.counseling_status')
      .select('leads.upload_batch_id as batch_id', 'lead_assignments.counseling_status')
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
    const statusMap = {};
    statusCounts.forEach(s => {
      if (!statusMap[s.batch_id]) statusMap[s.batch_id] = {};
      statusMap[s.batch_id][s.counseling_status] = parseInt(s.cnt, 10);
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
      // Absence from unassignedMap means the GROUP BY found zero unassigned rows for this
      // batch (i.e. every clean lead has already been distributed) - NOT that none were, so
      // the fallback must be 0, never b.clean_rows.
      const remainingClean = unassignedMap[b.id] !== undefined ? unassignedMap[b.id] : 0;
      const distributedClean = Math.max(0, b.clean_rows - remainingClean);
      return {
        ...b,
        statuses: statusMap[b.id] || {},
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
      // Counseling status breakdown per counselor for leads from this batch
      counselorStages = await db('leads')
        .join('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
        .where({ 'leads.upload_batch_id': batchId })
        .whereIn('lead_assignments.counselor_id', counselorIds)
        .groupBy('lead_assignments.counselor_id', 'lead_assignments.counseling_status')
        .select('lead_assignments.counselor_id', 'lead_assignments.counseling_status')
        .count('lead_assignments.id as cnt');

      // Conversion breakdown per counselor for leads from this batch.
      // Attribute via closures.counselor_id directly — a lead dropped straight from L1
      // never gets a 'tick' activity log, so the old join through that log silently
      // excluded those drops from this batch's per-counselor breakdown.
      counselorConversions = await db('leads')
        .join('closures', 'leads.id', 'closures.lead_id')
        .where({ 'leads.upload_batch_id': batchId })
        .whereIn('closures.counselor_id', counselorIds)
        .groupBy('closures.counselor_id', 'closures.final_status')
        .select('closures.counselor_id', 'closures.final_status')
        .count('closures.id as cnt')
        .sum('closures.revenue as total_revenue');
    }

    // Build status map per counselor
    const counselorStageMap = {};
    counselorStages.forEach(s => {
      if (!counselorStageMap[s.counselor_id]) counselorStageMap[s.counselor_id] = {};
      counselorStageMap[s.counselor_id][s.counseling_status] = parseInt(s.cnt, 10);
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
      statuses: counselorStageMap[a.counselor_id] || {},
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

      // Distribution history for this batch would otherwise be orphaned — the
      // distribution_batches.source_batch_id FK is ON DELETE SET NULL, so without this
      // it silently survives with source_batch_id=null and actual_lead_ids pointing at
      // now-deleted leads, forever. Delete it explicitly so removing a batch also removes
      // its full audit trail, consistent with everything else this endpoint cleans up.
      const distBatchIds = await trx('distribution_batches').where({ source_batch_id: batchId }).select('id');
      if (distBatchIds.length > 0) {
        await trx('distribution_allocations').whereIn('distribution_batch_id', distBatchIds.map(d => d.id)).delete();
        await trx('distribution_batches').whereIn('id', distBatchIds.map(d => d.id)).delete();
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

// GET /api/vault/batches/:id/conversions — list of leads from a batch by terminal outcome
app.get('/api/vault/batches/:id/conversions', authenticateToken, requireRole(['super_admin', 'manager']), async (req, res) => {
  const { id } = req.params;
  const { status } = req.query; // 'enrolled' | 'lost' | 'duplicate' | 'job_seeker'
  const VALID_TERMINAL_STATUSES = ['enrolled', 'lost', 'duplicate', 'job_seeker'];

  if (!status || !VALID_TERMINAL_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Query parameter 'status' must be one of: ${VALID_TERMINAL_STATUSES.join(', ')}` });
  }

  try {
    // Attribute via closures.counselor_id directly, not lead_assignments — dropping a
    // lead deletes its lead_assignments row, so every 'lost' lead here would otherwise
    // show a blank counselor name (the join would find nothing to match against).
    const leads = await db('leads')
      .join('closures', 'leads.id', 'closures.lead_id')
      .leftJoin('users as counselors', 'closures.counselor_id', 'counselors.id')
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
    // Currently active leads (still assigned to this counselor).
    const activeLeads = await db('leads')
      .join('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .leftJoin('universities', 'leads.university_id', 'universities.id')
      .where({ 'leads.upload_batch_id': batchId, 'lead_assignments.counselor_id': counselorId })
      .select('leads.*', 'lead_assignments.counseling_status', 'lead_assignments.status_remark', 'lead_assignments.registration_status', 'lead_assignments.fee_payment_status', 'lead_assignments.updated_at as assigned_updated_at', 'universities.name as university_name');

    // Leads this counselor closed out (terminal statuses) — closing deletes the
    // lead_assignments row, so these would otherwise vanish from this drill-down
    // entirely even though the counselor worked them. Attribute via closures.counselor_id,
    // the only durable record left. whereNull('lead_assignments.id') guards against
    // double-listing anything that somehow still has an active assignment (e.g.
    // reassigned after being closed once).
    const droppedLeads = await db('leads')
      .join('closures', 'leads.id', 'closures.lead_id')
      .leftJoin('lead_assignments', 'leads.id', 'lead_assignments.lead_id')
      .leftJoin('universities', 'leads.university_id', 'universities.id')
      .where({ 'leads.upload_batch_id': batchId, 'closures.counselor_id': counselorId })
      .whereIn('closures.final_status', ['lost', 'duplicate', 'job_seeker'])
      .whereNull('lead_assignments.id')
      .select(
        'leads.*',
        'closures.final_status',
        db.raw("closures.final_status as counseling_status"),
        'closures.drop_remark as status_remark',
        'closures.closed_at as assigned_updated_at',
        'universities.name as university_name'
      );

    const leads = [...activeLeads, ...droppedLeads].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
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
      .whereIn('closures.final_status', ['lost', 'duplicate', 'job_seeker']);

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
        'closures.final_status',
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

// GET /api/manager/leads/decompositions - get each lead's status-change journey
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
      .whereNotNull('lead_activity_log.lead_id')
      .whereIn('lead_activity_log.action', ['status_change', 'registration_update', 'fee_update', 'tick', 'cross']);

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

    // 4. Process journeys chronologically — every milestone here is read directly off a
    // known log action/prefix, no remark-text guessing.
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
          statusChange: null,
          registered: null,
          feeUpdate: null,
          finalOutcome: null
        };
      }

      const journey = leadJourneys[leadId];
      const milestone = { date: log.timestamp, counselor: log.counselor_name, remark: log.remark };

      if (log.action === 'status_change') {
        journey.statusChange = milestone;
      } else if (log.action === 'registration_update') {
        journey.registered = milestone;
      } else if (log.action === 'fee_update') {
        journey.feeUpdate = milestone;
      } else if (log.action === 'tick' || log.action === 'cross') {
        journey.finalOutcome = milestone;
      }
    });

    res.json(Object.values(leadJourneys));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve lead journey decompositions' });
  }
});


// --- LEAD FORWARDING TO MANAGER ---

// Fixed set of escalation categories so Team Leader/Manager reporting can filter and
// group escalations by root cause instead of parsing free-text remarks.
const ESCALATION_CATEGORIES = ['Finance Issue', 'Time Constraint', 'Decision Delay', 'Placement Concern', 'Other'];

// POST /api/counselor/leads/:id/forward - Counselor forwards lead to manager
app.post('/api/counselor/leads/:id/forward', authenticateToken, requireRole(['counselor']), async (req, res) => {
  const leadId = req.params.id;
  const { remark, category } = req.body;

  if (!remark) {
    return res.status(400).json({ error: 'Remark is required to forward lead to manager.' });
  }

  if (!category || !ESCALATION_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `A valid escalation category is required. Must be one of: ${ESCALATION_CATEGORIES.join(', ')}` });
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
        escalation_category: category,
        forwarded_at: new Date(),
        updated_at: new Date()
      });

      // 3. Log activity
      await logActivity(trx, leadId, req.user.id, 'forward_to_manager', `Forwarded to manager. Category: ${category}. Reason: ${remark}`);
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
        'lead_assignments.counseling_status',
        'lead_assignments.status_remark',
        'lead_assignments.registration_status',
        'lead_assignments.fee_payment_status',
        'lead_assignments.forward_remark',
        'lead_assignments.forwarded_at',
        'lead_assignments.escalation_category',
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
        // Send back to the original counselor: clear forwarded flag. Record the resolution
        // separately (escalation_resolved_at/type/note) so the counselor's dashboard can
        // surface "this came back from your manager" — is_forwarded/forward_remark only
        // capture that a lead IS currently escalated, not that it recently WAS.
        await trx('lead_assignments').where({ lead_id: leadId }).update({
          is_forwarded: false,
          forward_remark: null,
          forwarded_at: null,
          escalation_resolved_at: new Date(),
          escalation_resolution_type: 'send_back',
          escalation_resolution_note: managerRemark || null,
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

        // Reassign to target counselor and clear forwarded flag. Bump assigned_at to now
        // so the new counselor sees this as their Fresh Base today (matching how the
        // separate transfer-request approval path already reassigns leads).
        await trx('lead_assignments').where({ lead_id: leadId }).update({
          counselor_id: targetCounselorId,
          assigned_at: new Date(),
          is_forwarded: false,
          forward_remark: null,
          forwarded_at: null,
          escalation_resolved_at: new Date(),
          escalation_resolution_type: 'reassign',
          escalation_resolution_note: managerRemark || null,
          updated_at: new Date()
        });

        // Carry any still-open follow-up over to the new owner — see the identical fix
        // in /api/transfers/resolve/:id for why leaving it under the old counselor_id
        // makes it invisible to the new owner while still "due" for the old one.
        await trx('follow_ups')
          .where({ lead_id: leadId, counselor_id: assignment.counselor_id, completed: false })
          .update({ counselor_id: targetCounselorId });

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
  const targetDate = date || getISTDateString(); // default today (IST calendar date)

  // Build date window: start of day to end of day, IST (the business's actual timezone —
  // see getPeriodRange/getISTDayRange for why a plain Z-suffixed UTC boundary is wrong here)
  const { start: dayStart, end: dayEnd } = getISTDayRange(targetDate);

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
        'lead_assignments.counseling_status',
        'lead_assignments.not_contactable_reason',
        'lead_assignments.status_remark',
        'lead_assignments.registration_status',
        'lead_assignments.fee_payment_status',
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
          date: targetDate,
          summary: { total: 0, notContacted: 0, interested: 0, callBack: 0, cold: 0, notContactable: 0, leadPunched: 0, enrolled: 0, dropped: 0 },
          cfProgress: { openingCF: 0, freshBase: 0, cfAhead: 0, cfPending: 0, cfClosedToday: 0, cfOriginalTotal: 0 },
          categories: { notContacted: [], interested: [], callBack: [], cold: [], notContactable: [], leadPunched: [], enrolled: [], dropped: [], all: [] }
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
        // Exclude 'distributed' — auto-logged the moment a lead is allocated, not an actual
        // counselor touch (see the identical exclusion + rationale in computeDataReport
        // above). Without it, every freshly-distributed lead showed touchedToday: true
        // before the counselor had done anything with it.
        .whereNot('action', 'distributed')
        .where('timestamp', '>=', serializeDate(dayStart))
        .where('timestamp', '<=', serializeDate(dayEnd))
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

    // Categorize each lead by its flat counseling status
    const categorized = {
      notContacted: [],
      interested: [],
      callBack: [],
      cold: [],
      notContactable: [],
      leadPunched: [],
      enrolled: [],
      dropped: [],
      all: []
    };

    filtered.forEach(lead => {
      const entry = {
        ...lead,
        touchedToday: activeLeadIds.has(lead.id),
        activity_today: activityLogs.filter(a => a.lead_id === lead.id)
      };
      categorized.all.push(entry);

      // Closed/dropped leads
      if (lead.lead_status === 'closed' || lead.lead_status === 'invalid' || lead.lead_status === 'duplicate') {
        categorized.dropped.push(entry);
        return;
      }

      if (lead.counseling_status === 'Not Contacted') categorized.notContacted.push(entry);
      else if (lead.counseling_status === 'Interested') categorized.interested.push(entry);
      else if (lead.counseling_status === 'Call Back') categorized.callBack.push(entry);
      else if (lead.counseling_status === 'Cold') categorized.cold.push(entry);
      else if (lead.counseling_status === 'Not Contactable') categorized.notContactable.push(entry);
      else if (lead.counseling_status === 'Lead Punched') categorized.leadPunched.push(entry);
    });

    // Also fetch closures for enrolled on date. Scoped directly via closures.counselor_id /
    // team_id — NOT via whereIn('lead_id', leadIds) — because enrolling deletes the
    // lead_assignments row the same way dropping does (see the terminal path in
    // /api/counselor/leads/:id/status), so an enrolled lead's id is never actually in
    // leadIds; scoping through it would silently return zero enrolled leads for every role,
    // on every date.
    // whereNull('lead_assignments.id') guards against double-listing a lead that was closed
    // today and then reassigned/reopened later the same day — without it, such a lead would
    // count here AND in `leads`/`filtered` above (which reflects its current, reopened
    // assignment), double-counting it in any KPI that combines both (e.g. the counselor
    // dashboard's "Assigned Today"/"Processed Today" cards). Mirrors the identical guard on
    // GET /api/vault/batches/:batchId/counselors/:counselorId/leads.
    let enrolledQuery = db('closures')
      .join('users as enroll_counselor', 'closures.counselor_id', 'enroll_counselor.id')
      .leftJoin('lead_assignments', 'closures.lead_id', 'lead_assignments.lead_id')
      .whereNull('lead_assignments.id')
      .where('final_status', 'enrolled')
      .where('closed_at', '>=', serializeDate(dayStart))
      .where('closed_at', '<=', serializeDate(dayEnd))
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
        'closures.assignment_assigned_at',
        'universities.name as university_name'
      );

    if (req.user.role === 'counselor') {
      enrolledQuery = enrolledQuery.where('closures.counselor_id', req.user.id);
    } else if (req.user.role === 'team_leader') {
      enrolledQuery = enrolledQuery.where('enroll_counselor.team_id', req.user.team_id);
    }

    const closures = await enrolledQuery;

    // Attach today's activity log so "Activity Today" isn't blank for freshly enrolled leads either.
    if (closures.length > 0) {
      const enrolledLeadIds = closures.map(l => l.id);
      const enrolledActivityLogs = await db('lead_activity_log')
        .whereIn('lead_id', enrolledLeadIds)
        .where('timestamp', '>=', serializeDate(dayStart))
        .where('timestamp', '<=', serializeDate(dayEnd))
        .select('lead_id', 'action', 'remark', 'timestamp');

      closures.forEach(lead => {
        lead.activity_today = enrolledActivityLogs.filter(a => a.lead_id === lead.id);
      });
    }

    categorized.enrolled = closures;

    // Also fetch closures for dropped/lost leads on date. Dropping a lead deletes its
    // lead_assignments row (see /api/counselor/leads/:id/action, outcome 'cross'), so a
    // freshly dropped lead never matches the INNER JOIN the main query above depends on —
    // it would never surface here otherwise, no matter how recently it was dropped.
    // closures is the source of truth for who dropped it and when, same as enrolled above.
    let droppedQuery = db('closures')
      .leftJoin('lead_assignments', 'closures.lead_id', 'lead_assignments.lead_id')
      .whereNull('lead_assignments.id')
      .whereIn('final_status', ['lost', 'duplicate', 'job_seeker'])
      .where('closed_at', '>=', serializeDate(dayStart))
      .where('closed_at', '<=', serializeDate(dayEnd))
      .join('leads', 'closures.lead_id', 'leads.id')
      .join('users as drop_counselor', 'closures.counselor_id', 'drop_counselor.id')
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
        'closures.drop_stage',
        'closures.drop_remark',
        'closures.closed_at',
        'closures.assignment_assigned_at',
        'drop_counselor.id as counselor_id',
        'drop_counselor.name as counselor_name',
        'universities.name as university_name'
      );

    if (req.user.role === 'counselor') {
      droppedQuery = droppedQuery.where('closures.counselor_id', req.user.id);
    } else if (req.user.role === 'team_leader') {
      droppedQuery = droppedQuery.where('drop_counselor.team_id', req.user.team_id);
    }

    const droppedLeadsResult = await droppedQuery;

    // Attach today's activity log (e.g. the drop remark itself) so the "Activity Today"
    // column isn't blank for leads that were dropped today — same enrichment the leads
    // in `filtered` already get above.
    if (droppedLeadsResult.length > 0) {
      const droppedLeadIds = droppedLeadsResult.map(l => l.id);
      const droppedActivityLogs = await db('lead_activity_log')
        .whereIn('lead_id', droppedLeadIds)
        .where('timestamp', '>=', serializeDate(dayStart))
        .where('timestamp', '<=', serializeDate(dayEnd))
        .select('lead_id', 'action', 'remark', 'timestamp');

      droppedLeadsResult.forEach(lead => {
        lead.activity_today = droppedActivityLogs.filter(a => a.lead_id === lead.id);
      });
    }

    categorized.dropped = droppedLeadsResult;

    // Carry Forward progress for the selected date: of the leads already assigned before
    // that day started, how many have moved off Not Contacted — "ahead" — vs how many are
    // still sitting untouched — "pending". Leads that closed out entirely that day
    // (enrolled/dropped) have no lead_assignments row left to classify by counseling_status,
    // so they're counted as "ahead" via cfClosedToday, using the assignment_assigned_at
    // snapshot taken at closure time (null for closures written before that field existed).
    let cfOpen = 0, cfPending = 0, cfAhead = 0, freshOpen = 0;
    leads.forEach(lead => {
      const assignedAt = new Date(lead.assigned_at);
      if (assignedAt < dayStart) {
        cfOpen += 1;
        if (lead.counseling_status === 'Not Contacted') cfPending += 1;
        else cfAhead += 1;
      } else if (assignedAt >= dayStart && assignedAt <= dayEnd) {
        freshOpen += 1;
      }
    });
    const cfClosedToday = [...categorized.enrolled, ...categorized.dropped]
      .filter(l => l.assignment_assigned_at && new Date(l.assignment_assigned_at) < dayStart)
      .length;

    res.json({
      date: targetDate,
      summary: {
        // filtered.length never includes dropped leads (their assignment row is gone by
        // the time we query), so add the dropped count back in — otherwise today's
        // "total handled" figure silently undercounts every lead that got dropped today.
        total: filtered.length + categorized.dropped.length,
        notContacted: categorized.notContacted.length,
        interested: categorized.interested.length,
        callBack: categorized.callBack.length,
        cold: categorized.cold.length,
        notContactable: categorized.notContactable.length,
        leadPunched: categorized.leadPunched.length,
        enrolled: categorized.enrolled.length,
        dropped: categorized.dropped.length
      },
      cfProgress: {
        openingCF: cfOpen,
        freshBase: freshOpen,
        cfAhead,
        cfPending,
        cfClosedToday,
        cfOriginalTotal: cfOpen + cfClosedToday
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
      query = query.where('log.timestamp', '>=', serializeDate(getISTDayRange(date_from).start));
    }
    if (date_to) {
      query = query.where('log.timestamp', '<=', serializeDate(getISTDayRange(date_to).end));
    }
    if (search) {
      const q = `%${search.toLowerCase()}%`;
      query = query.where(function () {
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


// --- HIRING WORKSPACE (Phase 1) ---
// Fully isolated second workspace — its own tables (hiring_candidates, hiring_candidate_
// assignments, hiring_closures, hiring_interviews, hiring_follow_ups, hiring_transfer_
// requests, hiring_activity_log, hiring_teams, companies), its own roles (recruiter,
// hiring_team_leader), no shared data with anything above this line.
app.use('/api/hiring', authenticateToken, hiringRouter);

// --- SERVE BUILT FRONTEND (optional) ---
// Lets a single Node process serve the whole app (API + built React UI) for
// environments without a separate nginx/static host in front, e.g. sharing this
// server over a tunnel for internal testing. No-op if frontend/dist wasn't built.
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get(/^\/(?!api).*/, (req, res, next) => {
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) next();
  });
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

