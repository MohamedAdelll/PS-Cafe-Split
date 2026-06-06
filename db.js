const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'cafe.db');
const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);

fs.mkdirSync(path.dirname(resolvedDbPath), { recursive: true });

const db = new Database(resolvedDbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS groups (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    rate_per_hour REAL NOT NULL,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id                       TEXT PRIMARY KEY,
    group_id                 TEXT NOT NULL REFERENCES groups(id),
    started_at               INTEGER NOT NULL,
    ended_at                 INTEGER,
    current_interval_start   INTEGER NOT NULL,
    rate_snapshot            REAL
  );

  CREATE TABLE IF NOT EXISTS people (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL REFERENCES sessions(id),
    name        TEXT NOT NULL,
    joined_at   INTEGER NOT NULL,
    left_at     INTEGER
  );

  CREATE TABLE IF NOT EXISTS intervals (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id    TEXT NOT NULL REFERENCES sessions(id),
    started_at    INTEGER NOT NULL,
    ended_at      INTEGER NOT NULL,
    people_count  INTEGER NOT NULL,
    rate_per_hour REAL NOT NULL
  );
`);

module.exports = db;
