const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../../../db');
const { requireRole } = require('../../../auth');

const router = express.Router();

router.get('/teams', requireRole(['super_admin', 'hiring_team_leader']), async (req, res) => {
  try {
    const teams = await db('hiring_teams')
      .leftJoin('users', 'hiring_teams.leader_id', 'users.id')
      .select('hiring_teams.*', 'users.name as leader_name')
      .orderBy('hiring_teams.name', 'asc');
    res.json(teams);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch hiring teams' });
  }
});

router.post('/teams', requireRole(['super_admin']), async (req, res) => {
  const { name, leaderId } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required.' });
  try {
    const id = randomUUID();
    await db('hiring_teams').insert({ id, name: name.trim(), leader_id: leaderId || null, created_at: new Date() });
    if (leaderId) {
      await db('users').where({ id: leaderId }).update({ hiring_team_id: id, updated_at: new Date() });
    }
    res.status(201).json({ id, name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create hiring team' });
  }
});

router.put('/teams/:id', requireRole(['super_admin']), async (req, res) => {
  const { name, leaderId } = req.body;
  try {
    const team = await db('hiring_teams').where({ id: req.params.id }).first();
    if (!team) return res.status(404).json({ error: 'Team not found' });
    await db('hiring_teams').where({ id: req.params.id }).update({
      name: name !== undefined ? name.trim() : team.name,
      leader_id: leaderId !== undefined ? (leaderId || null) : team.leader_id
    });
    if (leaderId) {
      await db('users').where({ id: leaderId }).update({ hiring_team_id: req.params.id, updated_at: new Date() });
    }
    res.json({ id: req.params.id, message: 'Team updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update hiring team' });
  }
});

module.exports = router;
