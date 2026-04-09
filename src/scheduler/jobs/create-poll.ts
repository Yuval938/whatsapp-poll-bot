import { getLogger } from '../../utils/logger.js';
import * as pollRepo from '../../storage/repositories/poll.repo.js';
import { createWeeklyPoll } from '../../poll/manager.js';

export async function createPollJob(groupId: string): Promise<void> {
  const logger = getLogger();

  // Check if there's already an active poll
  const existing = pollRepo.getActivePoll(groupId);
  if (existing) {
    logger.info({ pollId: existing.id, groupId }, 'Active poll already exists, skipping creation');
    return;
  }

  logger.info({ groupId }, 'Creating weekly poll...');
  await createWeeklyPoll(groupId);
}
