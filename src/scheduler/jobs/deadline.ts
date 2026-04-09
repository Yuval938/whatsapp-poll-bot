import { getLogger } from '../../utils/logger.js';
import * as pollRepo from '../../storage/repositories/poll.repo.js';
import { analyzePoll } from '../../poll/analyzer.js';
import { generateNoGame } from '../../ai/prompts.js';
import { sendMessage } from '../../whatsapp/actions.js';
import { dayNameToHe } from '../../utils/date.js';

export async function deadlineJob(groupId: string): Promise<void> {
  const logger = getLogger();

  const poll = pollRepo.getActivePoll(groupId);
  if (!poll) {
    logger.debug({ groupId }, 'No active poll at deadline, nothing to do');
    return;
  }

  const result = analyzePoll(poll);

  if (result.isThresholdMet && result.winningDay) {
    pollRepo.concludePoll(poll.id, result.winningDay.day);
    const dayHe = dayNameToHe(result.winningDay.day);
    await sendMessage(groupId, `\ud83c\udfae \u05e0\u05e7\u05d1\u05e2! \u05de\u05e9\u05d7\u05e7\u05d9\u05dd \u05d1\u05d9\u05d5\u05dd ${dayHe}!`);
  } else {
    pollRepo.expirePoll(poll.id);
    logger.info({ groupId }, 'Poll expired at deadline');

    try {
      const message = await generateNoGame(result.tallies);
      await sendMessage(groupId, message);
    } catch (err) {
      logger.warn({ err, groupId }, 'Failed to generate AI no-game message');
      await sendMessage(groupId, '\ud83d\ude22 \u05d4\u05d6\u05de\u05df \u05e0\u05d2\u05de\u05e8 \u05d5\u05dc\u05d0 \u05d4\u05d2\u05e2\u05e0\u05d5 \u05dc\u05de\u05e1\u05e4\u05d9\u05e7 \u05d4\u05e6\u05d1\u05e2\u05d5\u05ea. \u05d0\u05d9\u05df \u05de\u05e9\u05d7\u05e7 \u05d4\u05e9\u05d1\u05d5\u05e2.');
    }
  }
}
