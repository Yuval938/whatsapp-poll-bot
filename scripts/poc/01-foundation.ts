/**
 * PoC 1 — Foundation Validation
 * Load config → init DB → run migration → insert a test row → query it → log result.
 */
import { resolve } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { loadConfig, loadEnv, resetConfig } from '../../src/config/index.js';
import { initLogger, getLogger } from '../../src/utils/logger.js';
import { initDatabase, closeDatabase, resetDatabase } from '../../src/storage/database.js';

const TEST_DB_PATH = resolve(process.cwd(), 'data', 'poc-test.db');

async function run(): Promise<void> {
  resetConfig(); resetDatabase();
  if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);

  const config = loadConfig();
  const env = loadEnv();
  const logger = initLogger(env.LOG_LEVEL);

  logger.info('=== PoC 1: Foundation ===');
  if (config.poll.vote_threshold !== 6) throw new Error('Threshold mismatch');
  if (config.poll.days_to_offer.length !== 7) throw new Error('Days mismatch');
  logger.info('✓ Config OK');

  const db = initDatabase(TEST_DB_PATH);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
  const names = tables.map((t: any) => t.name);
  for (const t of ['polls', 'votes', 'chat_history', 'bot_state', '_migrations']) {
    if (!names.includes(t)) throw new Error(`Missing table: ${t}`);
  }
  logger.info('✓ Tables OK');

  db.prepare('INSERT INTO chat_history (sender_id, sender_name, body, timestamp, is_from_bot) VALUES (?,?,?,?,?)')
    .run('test-user', 'Test', 'שלום!', new Date().toISOString(), 0);
  const row = db.prepare('SELECT * FROM chat_history WHERE sender_id = ?').get('test-user') as any;
  if (!row || row.body !== 'שלום!') throw new Error('Insert/query failed');
  logger.info('✓ DB read/write OK');

  closeDatabase();
  if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
  logger.info('=== PoC 1 PASSED ===');
}

run().catch(err => { console.error('FAILED:', err); process.exit(1); });