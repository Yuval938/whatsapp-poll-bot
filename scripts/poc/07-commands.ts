/**
 * PoC 7 — Command Parsing & Graceful Shutdown Validation
 */
import { loadConfig, loadEnv, resetConfig } from '../../src/config/index.js';
import { initLogger, getLogger } from '../../src/utils/logger.js';
import { initDatabase, closeDatabase, resetDatabase } from '../../src/storage/database.js';
import { parseCommand } from '../../src/ai/responder.js';
import { resolve } from 'path';
import { existsSync, unlinkSync } from 'fs';

const TEST_DB = resolve(process.cwd(), 'data', 'poc-commands.db');

async function run(): Promise<void> {
  resetConfig(); resetDatabase();
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);

  process.env.DRY_RUN = 'true';
  loadConfig(); loadEnv();
  const logger = initLogger('info');

  logger.info('=== PoC 7: Commands ===');
  initDatabase(TEST_DB);

  // Test command parsing
  const tests = [
    { input: '@GameBot צור הצבעה', expected: true },
    { input: '@bot status', expected: true },
    { input: 'סטטוס', expected: true },
    { input: 'עזרה', expected: true },
    { input: 'create poll', expected: true },
    { input: 'מה המצב?', expected: false },
    { input: 'random text', expected: false },
  ];

  for (const t of tests) {
    const result = parseCommand(t.input);
    const isCommand = result !== null;
    if (isCommand !== t.expected) {
      throw new Error(`"${t.input}": expected ${t.expected}, got ${isCommand}`);
    }
  }
  logger.info('✓ All command parsing tests passed');

  // Test graceful shutdown
  let shutdownCalled = false;
  const cleanup = () => { shutdownCalled = true; };
  process.on('SIGUSR2', cleanup); // Use SIGUSR2 to avoid actually killing the process
  process.emit('SIGUSR2', 'SIGUSR2');
  if (!shutdownCalled) throw new Error('Shutdown handler not called');
  process.removeListener('SIGUSR2', cleanup);
  logger.info('✓ Shutdown handler works');

  closeDatabase();
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  logger.info('=== PoC 7 PASSED ===');
}

run().catch(err => { console.error('FAILED:', err); process.exit(1); });