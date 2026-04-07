/**
 * PoC 3 — Full Poll Flow Validation
 * Create poll → 6 votes for Monday → threshold detected → conclusion logged → DB state verified.
 */
import { resolve } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { loadConfig, loadEnv, resetConfig } from '../../src/config/index.js';
import { initLogger, getLogger } from '../../src/utils/logger.js';
import { initDatabase, closeDatabase, resetDatabase } from '../../src/storage/database.js';
import { initClient } from '../../src/whatsapp/client.js';
import * as pollRepo from '../../src/storage/repositories/poll.repo.js';
import * as voteRepo from '../../src/storage/repositories/vote.repo.js';
import { analyzePoll } from '../../src/poll/analyzer.js';

const TEST_DB = resolve(process.cwd(), 'data', 'poc-poll.db');

async function run(): Promise<void> {
  resetConfig(); resetDatabase();
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);

  process.env.DRY_RUN = 'true';
  loadConfig(); loadEnv();
  const logger = initLogger('info');

  logger.info('=== PoC 3: Poll Flow ===');

  initDatabase(TEST_DB);
  await initClient();

  // Create poll
  const poll = pollRepo.createPoll({
    waMessageId: 'poc-poll-wa-1',
    pollName: 'מתי משחקים?',
    options: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    createdAt: new Date(),
    deadline: new Date(Date.now() + 3 * 86400000),
  });
  logger.info({ pollId: poll.id }, '✓ Poll created');

  // Simulate 6 votes for Monday
  for (let i = 0; i < 6; i++) {
    voteRepo.upsertVote(poll.id, `voter-${i}@c.us`, `Player${i}`, ['Monday']);
  }
  logger.info('✓ 6 votes recorded for Monday');

  // Analyze
  const result = analyzePoll(poll);
  if (!result.isThresholdMet) throw new Error('Threshold should be met');
  if (result.winningDay?.day !== 'Monday') throw new Error(`Expected Monday, got ${result.winningDay?.day}`);
  if (result.winningDay?.count !== 6) throw new Error(`Expected 6 votes, got ${result.winningDay?.count}`);
  logger.info('✓ Threshold detected correctly');

  // Conclude
  pollRepo.concludePoll(poll.id, 'Monday');
  const active = pollRepo.getActivePoll();
  if (active !== null) throw new Error('Poll should no longer be active');
  logger.info('✓ Poll concluded, no active polls remain');

  closeDatabase();
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  logger.info('=== PoC 3 PASSED ===');
}

run().catch(err => { console.error('FAILED:', err); process.exit(1); });