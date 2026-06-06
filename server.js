require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/dist')));

// ── Groups ──────────────────────────────────────────────

// Create group
app.post('/api/groups', (req, res) => {
  const { name, ratePerHour } = req.body;
  if (!name || !ratePerHour) return res.status(400).json({ error: 'name and ratePerHour required' });
  const id = require('crypto').randomBytes(4).toString('hex');
  db.prepare('INSERT INTO groups (id, name, rate_per_hour) VALUES (?, ?, ?)').run(id, name, ratePerHour);
  res.json(db.prepare('SELECT * FROM groups WHERE id = ?').get(id));
});

// Get group
app.get('/api/groups/:gid', (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.gid);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  res.json(group);
});

// Update group rate
app.patch('/api/groups/:gid', (req, res) => {
  const { ratePerHour } = req.body;
  if (!ratePerHour) return res.status(400).json({ error: 'ratePerHour required' });
  db.prepare('UPDATE groups SET rate_per_hour = ? WHERE id = ?').run(ratePerHour, req.params.gid);
  res.json(db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.gid));
});

// ── Sessions ─────────────────────────────────────────────

// Start session
app.post('/api/groups/:gid/sessions', (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.gid);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  const live = db.prepare('SELECT * FROM sessions WHERE group_id = ? AND ended_at IS NULL').get(req.params.gid);
  if (live) return res.status(409).json({ error: 'Session already active', session: live });
  const people = Array.isArray(req.body.people)
    ? req.body.people.map(name => String(name).trim()).filter(Boolean)
    : [];
  if (people.length === 0) return res.status(400).json({ error: 'At least one person is required to start a session' });
  const now = Date.now();
  const sid = require('crypto').randomBytes(4).toString('hex');
  const startSession = db.transaction(() => {
    db.prepare('INSERT INTO sessions (id, group_id, started_at, current_interval_start) VALUES (?, ?, ?, ?)').run(sid, req.params.gid, now, now);
    const insertPerson = db.prepare('INSERT INTO people (id, session_id, name, joined_at) VALUES (?, ?, ?, ?)');
    people.forEach(name => insertPerson.run(require('crypto').randomBytes(4).toString('hex'), sid, name, now));
  });
  startSession();
  res.json(getFullSession(sid));
});

// Get active session (or latest)
app.get('/api/groups/:gid/sessions/active', (req, res) => {
  const s = db.prepare('SELECT * FROM sessions WHERE group_id = ? AND ended_at IS NULL').get(req.params.gid)
    || db.prepare('SELECT * FROM sessions WHERE group_id = ? ORDER BY started_at DESC LIMIT 1').get(req.params.gid);
  if (!s) return res.json(null);
  res.json(getFullSession(s.id));
});

// Get session list
app.get('/api/groups/:gid/sessions', (req, res) => {
  const sessions = db.prepare('SELECT * FROM sessions WHERE group_id = ? ORDER BY started_at DESC').all(req.params.gid);
  res.json(sessions.map(s => getFullSession(s.id)));
});

// End session
app.post('/api/sessions/:sid/end', (req, res) => {
  const s = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.sid);
  if (!s || s.ended_at) return res.status(400).json({ error: 'No active session' });
  const now = Date.now();
  const active = db.prepare("SELECT * FROM people WHERE session_id = ? AND left_at IS NULL").all(s.id);
  if (active.length > 0) {
    db.prepare('INSERT INTO intervals (session_id, started_at, ended_at, people_count, rate_per_hour) VALUES (?, ?, ?, ?, ?)').run(s.id, s.current_interval_start, now, active.length, s.rate_snapshot || getGroupRate(s.group_id));
    active.forEach(p => db.prepare('UPDATE people SET left_at = ? WHERE id = ?').run(now, p.id));
  }
  db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?').run(now, s.id);
  res.json(getFullSession(s.id));
});

// ── People ────────────────────────────────────────────────

// Add person to session
app.post('/api/sessions/:sid/people', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const s = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.sid);
  if (!s || s.ended_at) return res.status(400).json({ error: 'Session not active' });
  const now = Date.now();
  const active = db.prepare("SELECT * FROM people WHERE session_id = ? AND left_at IS NULL").all(s.id);
  const rate = getGroupRate(s.group_id);
  if (active.length > 0) {
    db.prepare('INSERT INTO intervals (session_id, started_at, ended_at, people_count, rate_per_hour) VALUES (?, ?, ?, ?, ?)').run(s.id, s.current_interval_start, now, active.length, rate);
    db.prepare('UPDATE sessions SET current_interval_start = ? WHERE id = ?').run(now, s.id);
  }
  const pid = require('crypto').randomBytes(4).toString('hex');
  db.prepare('INSERT INTO people (id, session_id, name, joined_at) VALUES (?, ?, ?, ?)').run(pid, s.id, name, now);
  res.json(getFullSession(s.id));
});

// Mark person as left
app.post('/api/sessions/:sid/people/:pid/leave', (req, res) => {
  const s = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.sid);
  if (!s || s.ended_at) return res.status(400).json({ error: 'Session not active' });
  const p = db.prepare('SELECT * FROM people WHERE id = ? AND session_id = ?').get(req.params.pid, s.id);
  if (!p || p.left_at) return res.status(400).json({ error: 'Person not in session' });
  const now = Date.now();
  const active = db.prepare("SELECT * FROM people WHERE session_id = ? AND left_at IS NULL").all(s.id);
  const rate = getGroupRate(s.group_id);
  db.prepare('INSERT INTO intervals (session_id, started_at, ended_at, people_count, rate_per_hour) VALUES (?, ?, ?, ?, ?)').run(s.id, s.current_interval_start, now, active.length, rate);
  db.prepare('UPDATE sessions SET current_interval_start = ? WHERE id = ?').run(now, s.id);
  db.prepare('UPDATE people SET left_at = ? WHERE id = ?').run(now, p.id);
  res.json(getFullSession(s.id));
});

// ── Helpers ───────────────────────────────────────────────

function getGroupRate(gid) {
  return db.prepare('SELECT rate_per_hour FROM groups WHERE id = ?').get(gid)?.rate_per_hour || 0;
}

function getFullSession(sid) {
  const s = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sid);
  if (!s) return null;
  const people = db.prepare('SELECT * FROM people WHERE session_id = ? ORDER BY joined_at ASC').all(sid);
  const intervals = db.prepare('SELECT * FROM intervals WHERE session_id = ? ORDER BY started_at ASC').all(sid);
  return { ...s, people, intervals };
}

// Fallback to React app for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`PS Café Split running on http://localhost:${PORT}`));
