import { getLogger } from '../../utils/logger.js';
import { getConfig, getEnv } from '../../config/index.js';
import * as pollRepo from '../../storage/repositories/poll.repo.js';
import * as voteRepo from '../../storage/repositories/vote.repo.js';
import { analyzePoll } from '../../poll/analyzer.js';
import { generateReminder } from '../../ai/prompts.js';
import { sendMessage } from '../../whatsapp/actions.js';

export async function sendReminderJob(): Promise<void> {
  const logger = getLogger();
  const config = getConfig();
  const env = getEnv();

  const poll = pollRepo.getActivePoll();
  if (!poll) {
    logger.debug('No active poll, skipping reminder');
    return;
  }

  const voterCount = voteRepo.getUniqueVoterCount(poll.id);
  if (voterCount >= config.reminder.min_voters_before_reminder) {
    logger.debug({ voterCount, threshold: config.reminder.min_voters_before_reminder }, 'Enough voters, skipping reminder');
    return;
  }

  logger.info({ voterCount }, 'Sending vote reminder');

  const result = analyzePoll(poll);
  try {
    const message = await generateReminder(voterCount, result.tallies);
    await sendMessage(env.WHATSAPP_GROUP_ID, message);
  } catch (err) {
    logger.warn({ err }, 'Failed to generate AI reminder, using default');
    await sendMessage(env.WHATSAPP_GROUP_ID, `📢 רק ${voterCount} אנשים הצביעו! תצביעו כבר!`);
  }
}