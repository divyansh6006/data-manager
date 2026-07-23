const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../../../db');
const { requireRole } = require('../../../auth');

const router = express.Router();

// Read allowed for all 3 roles — recruiters need the list for dropdowns.
router.get('/companies', requireRole(['super_admin', 'hiring_team_leader', 'recruiter']), async (req, res) => {
  try {
    const companies = await db('companies').orderBy('name', 'asc');
    res.json(companies);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

router.post('/companies', requireRole(['super_admin', 'hiring_team_leader']), async (req, res) => {
  const { name, industry, location, website, contactPerson, contactEmail, contactPhone, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required.' });
  try {
    const id = randomUUID();
    await db('companies').insert({
      id, name: name.trim(), industry: industry || null, location: location || null, website: website || null,
      contact_person: contactPerson || null, contact_email: contactEmail || null, contact_phone: contactPhone || null,
      notes: notes || null, active: true, created_by: req.user.id, created_at: new Date(), updated_at: new Date()
    });
    res.status(201).json({ id, name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create company' });
  }
});

router.put('/companies/:id', requireRole(['super_admin', 'hiring_team_leader']), async (req, res) => {
  const { name, industry, location, website, contactPerson, contactEmail, contactPhone, notes } = req.body;
  try {
    const company = await db('companies').where({ id: req.params.id }).first();
    if (!company) return res.status(404).json({ error: 'Company not found' });
    await db('companies').where({ id: req.params.id }).update({
      name: name !== undefined ? name.trim() : company.name,
      industry: industry !== undefined ? industry : company.industry,
      location: location !== undefined ? location : company.location,
      website: website !== undefined ? website : company.website,
      contact_person: contactPerson !== undefined ? contactPerson : company.contact_person,
      contact_email: contactEmail !== undefined ? contactEmail : company.contact_email,
      contact_phone: contactPhone !== undefined ? contactPhone : company.contact_phone,
      notes: notes !== undefined ? notes : company.notes,
      updated_at: new Date()
    });
    res.json({ id: req.params.id, message: 'Company updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

router.put('/companies/:id/toggle', requireRole(['super_admin', 'hiring_team_leader']), async (req, res) => {
  try {
    const company = await db('companies').where({ id: req.params.id }).first();
    if (!company) return res.status(404).json({ error: 'Company not found' });
    const newStatus = !company.active;
    await db('companies').where({ id: req.params.id }).update({ active: newStatus, updated_at: new Date() });
    res.json({ id: req.params.id, active: newStatus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update company status' });
  }
});

module.exports = router;
