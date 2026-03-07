import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const dataDir = path.resolve(process.cwd(), 'data')
const dbPath = path.join(dataDir, 'pd2.sqlite')

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

export const db = new Database(dbPath)

db.pragma('journal_mode = WAL')

db.exec(`
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  captured_at TEXT NOT NULL,
  session_id TEXT NOT NULL,
  name TEXT,
  base_type TEXT NOT NULL,
  quality TEXT NOT NULL,
  i_level INTEGER NOT NULL,
  location TEXT NOT NULL,
  quantity INTEGER,
  display_name TEXT NOT NULL,
  is_corrupted INTEGER NOT NULL,
  icon_key TEXT,
  raw_json TEXT NOT NULL,
  fingerprint TEXT NOT NULL UNIQUE,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS item_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL,
  stat_name TEXT NOT NULL,
  stat_value REAL NOT NULL,
  range_min REAL,
  range_max REAL,
  stat_id INTEGER,
  FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE INDEX IF NOT EXISTS idx_items_captured_at ON items(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_session_id ON items(session_id);
`)
