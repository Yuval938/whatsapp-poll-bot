/**
 * PoC 2 — Dry-Run Mode Validation
 * Start in dry-run → simulate message → verify DB storage → simulate send → verify log.
 */
import { resolve } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { loadConfig, loadEnv, resetConfig } from '../../src/config/index.js';
import { initLogger, getLogger } from '../../src/utils/logger.js';
import { initDatabase, closeDatabase, resetDatabase } from '../../src/storage/database.js';
import { initClient, simulateMessage } from '../../src/whatsapp/client.js';
import { registerEventHandlers } from '../../src/whatsapp/events.js';
import { getRecentMessages } from '../../src/storage/repositories/chat.repo.js';
import { sendMessage } from '../../src/whatsapp/actions.js';

const TEST_DB = resolve(process.cwd(), 'data', 'poc-dry-run.db');

async function run(): Promise<void> {
  resetConfig(); resetDatabase();
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);

  process.env.DRY_RUN = 'true';
  const config = loadConfig();
  const env = loadEnv();
  const logger = initLogger('info');

  logger.info('=== PoC 2: Dry-Run Mode ===');

  initDatabase(TEST_DB);
  const client = await initClient();
  registerEventHandlers(client);
  logger.info('✓ Dry-run client initialized');

  // Simulate incoming message
  simulateMessage('user-1@c.us', 'Alice', 'מתי משחקים?', false);
  await new Promise(r => setTimeout(r, 200)); // Let event handler process

  const messages = getRecentMessages(10);
  if (messages.length === 0) throw new Error('Message not stored in chat_history');
  if (messages[0].body !== 'מתי משחקים?') throw new Error('Message body mismatch');
  logger.info('✓ Message stored in DB');

  // Simulate outbound message
  const msgId = await sendMessage('test-group@g.us', 'Test message from bot');
  if (!msgId) throw new Error('sendMessage returned no ID');
  logger.info('✓ sendMessage logged (dry-run)');

  await client.destroy();
  closeDatabase();
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  logger.info('=== PoC 2 PASSED ===');
}

run().catch(err => { console.error('FAILED:', err); process.exit(1); });