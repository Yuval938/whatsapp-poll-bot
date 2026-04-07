/**
 * PoC 4 — Scheduler Validation
 * Fast cron (every 2 seconds) → verify jobs fire 3 times each within 15 seconds.
 */
import { loadConfig, loadEnv, resetConfig } from '../../src/config/index.js';
import { initLogger, getLogger } from '../../src/utils/logger.js';
import { initDatabase, closeDatabase, resetDatabase } from '../../src/storage/database.js';
import { scheduleJob, stopScheduler } from '../../src/scheduler/index.js';
import { resolve } from 'path';
import { existsSync, unlinkSync } from 'fs';

const TEST_DB = resolve(process.cwd(), 'data', 'poc-scheduler.db');

async function run(): Promise<void> {
  resetConfig(); resetDatabase();
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);

  process.env.DRY_RUN = 'true';
  loadConfig(); loadEnv();
  const logger = initLogger('info');

  logger.info('=== PoC 4: Scheduler ===');
  initDatabase(TEST_DB);

  let jobACount = 0;
  let jobBCount = 0;

  scheduleJob('*/2 * * * * *', async () => { jobACount++; logger.info({ count: jobACount }, 'Job A fired'); });
  scheduleJob('*/3 * * * * *', async () => { jobBCount++; logger.info({ count: jobBCount }, 'Job B fired'); });

  logger.info('Waiting 15 seconds for jobs to fire...');
  await new Promise(r => setTimeout(r, 15000));

  stopScheduler();

  if (jobACount < 3) throw new Error(`Job A fired ${jobACount} times, expected >= 3`);
  if (jobBCount < 3) throw new Error(`Job B fired ${jobBCount} times, expected >= 3`);
  logger.info({ jobA: jobACount, jobB: jobBCount }, '✓ Both jobs fired >= 3 times');

  closeDatabase();
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  logger.info('=== PoC 4 PASSED ===');
}

run().catch(err => { console.error('FAILED:', err); process.exit(1); });