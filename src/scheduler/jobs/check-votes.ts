import { getLogger } from '../../utils/logger.js';
import * as pollRepo from '../../storage/repositories/poll.repo.js';
import { checkAndConclude } from '../../poll/manager.js';

export async function checkVotesJob(): Promise<void> {
  const logger = getLogger();

  const poll = pollRepo.getActivePoll();
  if (!poll) {
    logger.debug('No active poll, skipping vote check');
    return;
  }

  logger.debug({ pollId: poll.id }, 'Running fallback vote check');
  await checkAndConclude(poll);
}