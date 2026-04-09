import { getDatabase } from '../database.js';

export function setState(key: string, value: string): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO bot_state (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

export function getState(key: string): string | null {
  const db = getDatabase();
  const row = db.prepare('SELECT value FROM bot_state WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setStateJson(key: string, value: unknown): void {
  setState(key, JSON.stringify(value));
}

export function getStateJson<T = unknown>(key: string): T | null {
  const raw = getState(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function listStateByPrefix(prefix: string): Array<{ key: string; value: string }> {
  const db = getDatabase();
  return db.prepare('SELECT key, value FROM bot_state WHERE key LIKE ? ORDER BY key').all(`${prefix}%`) as Array<{ key: string; value: string }>;
}
