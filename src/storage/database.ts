import Database from 'better-sqlite3';
import { resolve } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { getLogger } from '../utils/logger.js';

let _db: Database.Database | null = null;

const MIGRATIONS: Array<{ version: number; name: string; sql: string }> = [
  {
    version: 1,
    name: 'initial-schema',
    sql: `
      CREATE TABLE IF NOT EXISTS polls (
        id TEXT PRIMARY KEY,
        wa_message_id TEXT NOT NULL,
        poll_name TEXT NOT NULL,
        options TEXT NOT NULL,
        created_at TEXT NOT NULL,
        deadline TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        concluded_day TEXT,
        concluded_at TEXT
      );

      CREATE TABLE IF NOT EXISTS votes (
        id TEXT PRIMARY KEY,
        poll_id TEXT NOT NULL REFERENCES polls(id),
        voter_id TEXT NOT NULL,
        voter_name TEXT,
        selected_days TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(poll_id, voter_id)
      );

      CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id TEXT NOT NULL,
        sender_name TEXT,
        body TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        is_from_bot INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS bot_state (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_votes_poll ON votes(poll_id);
      CREATE INDEX IF NOT EXISTS idx_chat_ts ON chat_history(timestamp);
    `,
  },
];

export function initDatabase(dbPath?: string): Database.Database {
  if (_db) return _db;
  const logger = getLogger();
  const finalPath = dbPath ?? resolve(process.cwd(), 'data', 'bot.db');
  const dir = resolve(finalPath, '..');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  _db = new Database(finalPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  runMigrations(_db);
  logger.info({ path: finalPath }, 'Database initialized');
  return _db;
}

function runMigrations(db: Database.Database): void {
  const logger = getLogger();
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
  const applied = new Set(
    db.prepare('SELECT version FROM _migrations').all().map((r: any) => r.version)
  );
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    logger.info({ version: migration.version, name: migration.name }, 'Running migration');
    db.exec(migration.sql);
    db.prepare('INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
      migration.version, migration.name, new Date().toISOString()
    );
  }
}

export function getDatabase(): Database.Database {
  if (!_db) throw new Error('Database not initialized. Call initDatabase() first.');
  return _db;
}

export function closeDatabase(): void {
  if (_db) { _db.close(); _db = null; }
}

export function resetDatabase(): void {
  _db = null;
}