import { getLogger } from '../../utils/logger.js';
import * as pollRepo from '../../storage/repositories/poll.repo.js';
import { createWeeklyPoll } from '../../poll/manager.js';

export async function createPollJob(): Promise<void> {
  const logger = getLogger();

  // Check if there's already an active poll
  const existing = pollRepo.getActivePoll();
  if (existing) {
    logger.info({ pollId: existing.id }, 'Active poll already exists, skipping creation');
    return;
  }

  logger.info('Creating weekly poll...');
  await createWeeklyPoll();
}