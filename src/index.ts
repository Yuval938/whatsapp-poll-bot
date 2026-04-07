import { loadConfig, loadEnv, getEnv } from './config/index.js';
import { initLogger, getLogger } from './utils/logger.js';
import { initDatabase, closeDatabase } from './storage/database.js';
import { initClient, getClient } from './whatsapp/client.js';
import { registerEventHandlers } from './whatsapp/events.js';
import { startScheduler, stopScheduler } from './scheduler/index.js';
import { createInterface } from 'readline';
import { simulateMessage, simulateVote } from './whatsapp/client.js';

async function main(): Promise<void> {
  // Step 1: Load configuration
  const config = loadConfig();
  const env = loadEnv();
  const logger = initLogger(env.LOG_LEVEL);

  logger.info('=== WhatsApp Game Night Bot ===');
  logger.info({ dryRun: env.DRY_RUN, aiProvider: env.AI_PROVIDER, aiModel: env.AI_MODEL }, 'Configuration loaded');

  // Step 2: Initialize database
  initDatabase();

  // Step 3: Initialize WhatsApp client
  const client = await initClient();

  // Step 4: Register event handlers
  registerEventHandlers(client);

  // Step 5: Start scheduler
  startScheduler();

  // Step 6: If dry-run, start interactive CLI for testing
  if (env.DRY_RUN) {
    startDryRunCLI();
  }

  logger.info('Bot is running. Press Ctrl+C to stop.');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    stopScheduler();
    try {
      await getClient().destroy();
    } catch {}
    closeDatabase();
    logger.info('Goodbye!');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function startDryRunCLI(): void {
  const logger = getLogger();
  const env = getEnv();

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  logger.info('--- Dry-Run CLI ---');
  logger.info('Commands:');
  logger.info('  msg <text>          — simulate an incoming message');
  logger.info('  mention <text>      — simulate a message that mentions the bot');
  logger.info('  vote <msgId> <days> — simulate a vote (e.g., vote mock-msg-1 Monday,Wednesday)');
  logger.info('  quit                — exit');

  rl.on('line', async (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      if (trimmed.startsWith('msg ')) {
        const text = trimmed.slice(4);
        simulateMessage('test-user@c.us', 'TestUser', text, false);
      } else if (trimmed.startsWith('mention ')) {
        const text = trimmed.slice(8);
        simulateMessage('test-user@c.us', 'TestUser', text, true);
      } else if (trimmed.startsWith('vote ')) {
        const parts = trimmed.slice(5).split(' ');
        const msgId = parts[0];
        const days = parts[1]?.split(',') ?? [];
        simulateVote(msgId, 'test-voter@c.us', 'TestVoter', days);
      } else if (trimmed === 'quit' || trimmed === 'exit') {
        process.emit('SIGINT', 'SIGINT');
      } else {
        logger.warn(`Unknown command: ${trimmed}`);
      }
    } catch (err) {
      logger.error({ err }, 'CLI command error');
    }
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});