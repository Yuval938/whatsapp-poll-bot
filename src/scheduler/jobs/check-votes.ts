import { getLogger } from '../../utils/logger.js';
import * as pollRepo from '../../storage/repositories/poll.repo.js';
import { checkAndConclude } from '../../poll/manager.js';

export async function checkVotesJob(groupId: string): Promise<void> {
  const logger = getLogger();

  const poll = pollRepo.getActivePoll(groupId);
  if (!poll) {
    logger.debug({ groupId }, 'No active poll, skipping vote check');
    return;
  }

  logger.debug({ pollId: poll.id, groupId }, 'Running fallback vote check');
  await checkAndConclude(poll);
}
