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
  item_level INTEGER NOT NULL,
  location TEXT NOT NULL,
  defense INTEGER,
  quantity INTEGER,
  display_name TEXT NOT NULL,
  is_corrupted INTEGER NOT NULL,
  icon_key TEXT,
  category TEXT NOT NULL DEFAULT 'misc',
  analysis_profile TEXT NOT NULL DEFAULT 'unknown',
  analysis_tags TEXT NOT NULL DEFAULT '[]',
  raw_json TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS item_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL,
  stat_name TEXT NOT NULL,
  stat_value REAL,
  range_min REAL,
  range_max REAL,
  stat_id INTEGER,
  corrupted INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`)

interface TableInfoRow {
  name: string
  notnull: number
}

interface IndexListRow {
  name: string
  unique: number
}

interface IndexInfoRow {
  name: string
}

function hasColumn(tableName: string, columnName: string): boolean {
  const columns = db.prepare<[], TableInfoRow>(`PRAGMA table_info(${tableName})`).all()
  return columns.some((column) => column.name === columnName)
}

function isColumnNotNull(tableName: string, columnName: string): boolean {
  const columns = db.prepare<[], TableInfoRow>(`PRAGMA table_info(${tableName})`).all()
  return columns.some((column) => column.name === columnName && column.notnull === 1)
}

function hasUniqueFingerprintIndex(): boolean {
  const indexes = db.prepare<[], IndexListRow>("PRAGMA index_list('items')").all()
  for (const index of indexes) {
    if (index.unique !== 1) {
      continue
    }
    const columns = db.prepare<[], IndexInfoRow>(`PRAGMA index_info(${index.name})`).all()
    if (columns.length === 1 && columns[0].name === 'fingerprint') {
      return true
    }
  }
  return false
}

function migrateItemsTableWithoutFingerprintUnique(): void {
  db.exec(`
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS items_new (
  id TEXT PRIMARY KEY,
  captured_at TEXT NOT NULL,
  session_id TEXT NOT NULL,
  name TEXT,
  base_type TEXT NOT NULL,
  quality TEXT NOT NULL,
  item_level INTEGER NOT NULL,
  location TEXT NOT NULL,
  defense INTEGER,
  quantity INTEGER,
  display_name TEXT NOT NULL,
  is_corrupted INTEGER NOT NULL,
  icon_key TEXT,
  category TEXT NOT NULL DEFAULT 'misc',
  analysis_profile TEXT NOT NULL DEFAULT 'unknown',
  analysis_tags TEXT NOT NULL DEFAULT '[]',
  raw_json TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

INSERT INTO items_new (
  id, captured_at, session_id, name, base_type, quality, item_level, location,
  defense, quantity, display_name, is_corrupted, icon_key, category, analysis_profile, analysis_tags, raw_json, fingerprint
)
SELECT
  id,
  captured_at,
  session_id,
  name,
  base_type,
  quality,
  i_level,
  location,
  NULL AS defense,
  quantity,
  display_name,
  is_corrupted,
  icon_key,
  'misc' AS category,
  'unknown' AS analysis_profile,
  '[]' AS analysis_tags,
  raw_json,
  fingerprint
FROM items;

DROP TABLE items;
ALTER TABLE items_new RENAME TO items;

PRAGMA foreign_keys = ON;
`)
}

function rebuildItemsTableToFinalSchema(): void {
  db.exec(`
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS items_final (
  id TEXT PRIMARY KEY,
  captured_at TEXT NOT NULL,
  session_id TEXT NOT NULL,
  name TEXT,
  base_type TEXT NOT NULL,
  quality TEXT NOT NULL,
  item_level INTEGER NOT NULL,
  location TEXT NOT NULL,
  defense INTEGER,
  quantity INTEGER,
  display_name TEXT NOT NULL,
  is_corrupted INTEGER NOT NULL,
  icon_key TEXT,
  category TEXT NOT NULL DEFAULT 'misc',
  analysis_profile TEXT NOT NULL DEFAULT 'unknown',
  analysis_tags TEXT NOT NULL DEFAULT '[]',
  raw_json TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

INSERT INTO items_final (
  id, captured_at, session_id, name, base_type, quality, item_level, location,
  defense, quantity, display_name, is_corrupted, icon_key, category, analysis_profile, analysis_tags, raw_json, fingerprint
)
SELECT
  id,
  captured_at,
  session_id,
  name,
  base_type,
  quality,
  COALESCE(item_level, i_level, 0) AS item_level,
  location,
  defense,
  quantity,
  display_name,
  is_corrupted,
  icon_key,
  category,
  analysis_profile,
  analysis_tags,
  raw_json,
  fingerprint
FROM items;

DROP TABLE items;
ALTER TABLE items_final RENAME TO items;

PRAGMA foreign_keys = ON;
`)
}

if (hasUniqueFingerprintIndex()) {
  migrateItemsTableWithoutFingerprintUnique()
}

if (!hasColumn('items', 'defense')) {
  db.exec('ALTER TABLE items ADD COLUMN defense INTEGER')
}

if (!hasColumn('items', 'item_level')) {
  db.exec('ALTER TABLE items ADD COLUMN item_level INTEGER')
}

if (hasColumn('items', 'i_level')) {
  db.exec('UPDATE items SET item_level = COALESCE(item_level, i_level)')
}

db.exec('UPDATE items SET item_level = COALESCE(item_level, 0)')

if (hasColumn('items', 'i_level')) {
  rebuildItemsTableToFinalSchema()
}

if (!hasColumn('items', 'category')) {
  db.exec("ALTER TABLE items ADD COLUMN category TEXT NOT NULL DEFAULT 'misc'")
}

if (!hasColumn('items', 'analysis_profile')) {
  db.exec("ALTER TABLE items ADD COLUMN analysis_profile TEXT NOT NULL DEFAULT 'unknown'")
}

if (!hasColumn('items', 'analysis_tags')) {
  db.exec("ALTER TABLE items ADD COLUMN analysis_tags TEXT NOT NULL DEFAULT '[]'")
}

if (!hasColumn('item_stats', 'corrupted')) {
  db.exec('ALTER TABLE item_stats ADD COLUMN corrupted INTEGER NOT NULL DEFAULT 0')
}

if (isColumnNotNull('item_stats', 'stat_value')) {
  db.exec(`
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS item_stats_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL,
  stat_name TEXT NOT NULL,
  stat_value REAL,
  range_min REAL,
  range_max REAL,
  stat_id INTEGER,
  corrupted INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (item_id) REFERENCES items(id)
);

INSERT INTO item_stats_new (
  id, item_id, stat_name, stat_value, range_min, range_max, stat_id, corrupted
)
SELECT
  id, item_id, stat_name, stat_value, range_min, range_max, stat_id, corrupted
FROM item_stats;

DROP TABLE item_stats;
ALTER TABLE item_stats_new RENAME TO item_stats;

PRAGMA foreign_keys = ON;
`)
}

db.exec(`
CREATE INDEX IF NOT EXISTS idx_items_captured_at ON items(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_session_id ON items(session_id);
CREATE INDEX IF NOT EXISTS idx_items_fingerprint_captured ON items(fingerprint, captured_at DESC);
`)
