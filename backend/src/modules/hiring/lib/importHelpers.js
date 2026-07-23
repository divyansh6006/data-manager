// Small, self-contained Excel/CSV import helpers for Hiring candidate bulk upload —
// deliberately duplicated (not imported) from the equivalent logic in backend/src/index.js
// (cleanPhone, FIELD_ALIASES/autoMapHeaders, parseExperience) rather than exported from
// that file, so the existing Admissions upload pipeline is never touched.

function cleanPhone(phone) {
  if (!phone) return '';
  let str = String(phone).trim();
  if (str.toLowerCase().includes('e+')) {
    const num = Number(str);
    if (!isNaN(num)) str = String(num);
  }
  if (str.endsWith('.0')) str = str.substring(0, str.length - 2);
  return str.replace(/\D/g, '');
}

function parseExperience(val) {
  if (val === undefined || val === null) return null;
  const str = String(val).trim().toLowerCase();
  if (str === '') return null;
  if (/^\d+(\.\d+)?$/.test(str)) return parseFloat(str);

  let years = 0, months = 0, matched = false;
  const yearMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:year|yr)/i);
  const monthMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:month|mo)/i);
  if (yearMatch) { years = parseFloat(yearMatch[1]); matched = true; }
  if (monthMatch) { months = parseFloat(monthMatch[1]); matched = true; }
  if (matched) return parseFloat((years + months / 12).toFixed(2));

  const startNumMatch = str.match(/^(\d+(?:\.\d+)?)/);
  if (startNumMatch) return parseFloat(startNumMatch[1]);
  return NaN;
}

// Hiring-specific field set — deliberately no university/course/country aliases.
const FIELD_ALIASES = {
  name: ['name', 'candidatename', 'candidate', 'fullname', 'username', 'firstname', 'first', 'lastname', 'last'],
  phone: ['phone', 'phoneno', 'mobile', 'mobileno', 'contact', 'contactno', 'contactnumber', 'phonenumber', 'mobilenumber', 'number', 'telephone'],
  email: ['email', 'emailid', 'emailaddress', 'e-mail', 'mail', 'mailid'],
  current_location: ['location', 'currentlocation', 'city', 'cityname', 'town', 'address'],
  experience: ['experience', 'totalexperience', 'exp', 'yearsofexperience', 'experienceyrs', 'experienceyears', 'workexperience'],
  current_company: ['company', 'currentcompany', 'organisation', 'org', 'workplace', 'employer'],
  expected_salary: ['expectedsalary', 'expectedctc', 'salary', 'budget', 'expectation'],
  notice_period: ['noticeperiod', 'notice'],
  skills: ['skills', 'skillset', 'keyskills', 'technicalskills'],
  source: ['source', 'candidatesource', 'utmsource', 'platform']
};

function normalizeHeader(header) {
  if (!header) return '';
  return String(header).toLowerCase().replace(/[^a-z0-9]/g, '');
}

const NORMALIZED_ALIASES = {};
for (const [field, list] of Object.entries(FIELD_ALIASES)) {
  NORMALIZED_ALIASES[field] = list.map(normalizeHeader);
}

function autoMapHeaders(headers) {
  const mapping = {};
  for (const field of Object.keys(FIELD_ALIASES)) mapping[field] = null;
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

module.exports = { cleanPhone, parseExperience, FIELD_ALIASES, autoMapHeaders };
