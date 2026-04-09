import { getLogger } from '../../utils/logger.js';
import { getConfig } from '../../config/index.js';
import * as pollRepo from '../../storage/repositories/poll.repo.js';
import * as voteRepo from '../../storage/repositories/vote.repo.js';
import { analyzePoll } from '../../poll/analyzer.js';
import { generateReminder } from '../../ai/prompts.js';
import { sendMessage } from '../../whatsapp/actions.js';

export async function sendReminderJob(groupId: string): Promise<void> {
  const logger = getLogger();
  const config = getConfig();

  const poll = pollRepo.getActivePoll(groupId);
  if (!poll) {
    logger.debug({ groupId }, 'No active poll, skipping reminder');
    return;
  }

  const voterCount = voteRepo.getUniqueVoterCount(poll.id);
  if (voterCount >= config.reminder.min_voters_before_reminder) {
    logger.debug({ groupId, voterCount, threshold: config.reminder.min_voters_before_reminder }, 'Enough voters, skipping reminder');
    return;
  }

  logger.info({ groupId, voterCount }, 'Sending vote reminder');

  const result = analyzePoll(poll);
  try {
    const message = await generateReminder(voterCount, result.tallies);
    await sendMessage(groupId, message);
  } catch (err) {
    logger.warn({ err, groupId }, 'Failed to generate AI reminder, using default');
    await sendMessage(groupId, `\ud83d\udce2 \u05e8\u05e7 ${voterCount} \u05d0\u05e0\u05e9\u05d9\u05dd \u05d4\u05e6\u05d1\u05d9\u05e2\u05d5! \u05ea\u05e6\u05d1\u05d9\u05e2\u05d5 \u05db\u05d1\u05e8!`);
  }
}
