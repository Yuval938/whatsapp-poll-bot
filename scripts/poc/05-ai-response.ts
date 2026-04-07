/**
 * PoC 5 — AI Response Validation
 * Seed chat history → build system prompt → call AI → verify Hebrew response.
 * Requires ANTHROPIC_API_KEY or OPENAI_API_KEY in .env.
 */
import { resolve } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { loadConfig, loadEnv, resetConfig } from '../../src/config/index.js';
import { initLogger, getLogger } from '../../src/utils/logger.js';
import { initDatabase, closeDatabase, resetDatabase } from '../../src/storage/database.js';
import { insertChatMessage } from '../../src/storage/repositories/chat.repo.js';
import { buildSystemPrompt } from '../../src/ai/personality.js';
import { generate } from '../../src/ai/provider.js';

const TEST_DB = resolve(process.cwd(), 'data', 'poc-ai.db');

async function run(): Promise<void> {
  resetConfig(); resetDatabase();
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);

  process.env.DRY_RUN = 'true';
  loadConfig(); const env = loadEnv();
  const logger = initLogger('info');

  logger.info('=== PoC 5: AI Response ===');

  if (!env.ANTHROPIC_API_KEY && !env.OPENAI_API_KEY) {
    logger.warn('No API key configured — skipping AI test (set ANTHROPIC_API_KEY or OPENAI_API_KEY)');
    logger.info('=== PoC 5 SKIPPED (no API key) ===');
    return;
  }

  initDatabase(TEST_DB);

  // Seed chat history
  const sampleMessages = [
    { sender: 'user1', name: 'יובל', body: 'מה קורה חבר\'ה?' },
    { sender: 'user2', name: 'דן', body: 'אחי מתי משחקים השבוע?' },
    { sender: 'user3', name: 'נועם', body: 'אני יכול רק ביום שלישי' },
    { sender: 'user1', name: 'יובל', body: 'שני או שלישי עובד לי' },
    { sender: 'user4', name: 'רון', body: 'מה המשחק?' },
    { sender: 'user2', name: 'דן', body: 'קטאן כמו תמיד' },
    { sender: 'user5', name: 'עמית', body: 'אני בפנים לכל יום' },
    { sender: 'user3', name: 'נועם', body: 'מישהו מביא חטיפים?' },
    { sender: 'user6', name: 'גיל', body: 'אני מביא!' },
    { sender: 'user4', name: 'רון', body: 'נשמע מעולה' },
  ];

  for (const msg of sampleMessages) {
    insertChatMessage(msg.sender, msg.name, msg.body, false);
  }
  logger.info('✓ Chat history seeded');

  const systemPrompt = buildSystemPrompt();
  logger.info({ length: systemPrompt.length }, '✓ System prompt built');

  const response = await generate(systemPrompt, 'מתי משחקים השבוע?');
  logger.info({ response }, '✓ AI response received');

  // Basic validation: response should contain Hebrew characters
  if (!/[\u0590-\u05FF]/.test(response)) {
    throw new Error('Response does not contain Hebrew text');
  }
  logger.info('✓ Response is in Hebrew');

  closeDatabase();
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  logger.info('=== PoC 5 PASSED ===');
}

run().catch(err => { console.error('FAILED:', err); process.exit(1); });