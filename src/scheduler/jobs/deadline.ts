import { getLogger } from '../../utils/logger.js';
import { getConfig, getEnv } from '../../config/index.js';
import * as pollRepo from '../../storage/repositories/poll.repo.js';
import { analyzePoll } from '../../poll/analyzer.js';
import { generateNoGame } from '../../ai/prompts.js';
import { sendMessage } from '../../whatsapp/actions.js';
import { dayNameToHe } from '../../utils/date.js';

export async function deadlineJob(): Promise<void> {
  const logger = getLogger();
  const env = getEnv();
  const config = getConfig();

  const poll = pollRepo.getActivePoll();
  if (!poll) {
    logger.debug('No active poll at deadline, nothing to do');
    return;
  }

  const result = analyzePoll(poll);

  if (result.isThresholdMet && result.winningDay) {
    // Threshold was met but not announced yet (edge case)
    pollRepo.concludePoll(poll.id, result.winningDay.day);
    const dayHe = dayNameToHe(result.winningDay.day);
    await sendMessage(env.WHATSAPP_GROUP_ID, `🎮 נקבע! משחקים ביום ${dayHe}!`);
  } else {
    // Deadline passed, no day reached threshold
    pollRepo.expirePoll(poll.id);
    logger.info('Poll expired at deadline');

    try {
      const message = await generateNoGame(result.tallies);
      await sendMessage(env.WHATSAPP_GROUP_ID, message);
    } catch (err) {
      logger.warn({ err }, 'Failed to generate AI no-game message');
      await sendMessage(env.WHATSAPP_GROUP_ID, '😢 הזמן נגמר ולא הגענו למספיק הצבעות. אין משחק השבוע.');
    }
  }
}