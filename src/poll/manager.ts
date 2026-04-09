import { getConfig, getEnv } from '../config/index.js';
import { getLogger } from '../utils/logger.js';
import { dayNameToHe, getDeadline, allDaysToHe } from '../utils/date.js';
import * as pollRepo from '../storage/repositories/poll.repo.js';
import * as voteRepo from '../storage/repositories/vote.repo.js';
import { analyzePoll } from './analyzer.js';
import { sendPoll, sendMessage } from '../whatsapp/actions.js';
import { generatePollAnnouncement, generateGameConfirmed, generateNoGame } from '../ai/prompts.js';
import type { ActivePoll, PollResult } from './types.js';

export async function createWeeklyPoll(groupId?: string): Promise<ActivePoll | null> {
  const logger = getLogger();
  const config = getConfig();
  const env = getEnv();
  const targetGroupId = groupId ?? env.WHATSAPP_GROUP_ID;

  const expired = pollRepo.expireAllActivePolls(targetGroupId);
  if (expired > 0) {
    logger.info({ expired, groupId: targetGroupId }, 'Expired previous active polls');
  }

  let announcement: string;
  try {
    announcement = await generatePollAnnouncement(targetGroupId);
  } catch (err) {
    logger.warn({ err }, 'Failed to generate AI announcement, using default');
    announcement = 'חברים, פותחים סקר לשבוע הקרוב 🎮';
  }

  const pollName = 'מתי משחקים השבוע? 🎮';
  const options = config.poll.days_to_offer;
  const deadline = getDeadline(config.schedule.timezone, config.schedule.poll_deadline_cron);

  await sendMessage(targetGroupId, announcement);

  let waMessageId: string;
  try {
    waMessageId = await sendPoll(
      targetGroupId,
      pollName,
      allDaysToHe(options),
      { allowMultipleAnswers: config.poll.allow_multiple_answers }
    );
  } catch (err) {
    logger.error({ err }, 'Poll send failed');
    await sendMessage(
      targetGroupId,
      'לא הצלחתי לפרסם סקר וואטסאפ כרגע. נסו שוב עוד כמה דקות או פתחו ידנית.'
    );
    return null;
  }

  const poll = pollRepo.createPoll({
    groupId: targetGroupId,
    waMessageId,
    pollName,
    options,
    createdAt: new Date(),
    deadline,
  });

  logger.info({ pollId: poll.id, deadline: deadline.toISOString() }, 'Weekly poll created');
  return poll;
}

export async function handleVote(pollWaMessageId: string, voterId: string, voterName: string | null, selectedDays: string[]): Promise<void> {
  const logger = getLogger();

  const poll = pollRepo.getPollByWaMessageId(pollWaMessageId);
  if (!poll || poll.status !== 'active') {
    logger.debug({ pollWaMessageId }, 'Vote for non-active or unknown poll, ignoring');
    return;
  }

  voteRepo.upsertVote(poll.id, voterId, voterName, selectedDays);
  logger.info({ pollId: poll.id, voterId, selectedDays }, 'Vote recorded');

  await checkAndConclude(poll);
}

export async function checkAndConclude(poll?: ActivePoll): Promise<PollResult | null> {
  const logger = getLogger();
  const env = getEnv();

  if (!poll) {
    poll = pollRepo.getActivePoll(env.WHATSAPP_GROUP_ID) ?? undefined;
  }
  if (!poll || poll.status !== 'active') return null;
  const targetGroupId = poll.groupId || env.WHATSAPP_GROUP_ID;

  const result = analyzePoll(poll);

  if (result.isThresholdMet && result.winningDay) {
    pollRepo.concludePoll(poll.id, result.winningDay.day);
    logger.info({ day: result.winningDay.day, votes: result.winningDay.count }, 'Poll concluded - game day confirmed');

    try {
      const message = await generateGameConfirmed(result.winningDay.day, result.winningDay.voters);
      await sendMessage(targetGroupId, message);
    } catch (err) {
      logger.warn({ err }, 'Failed to generate AI confirmation, using default');
      const dayHe = dayNameToHe(result.winningDay.day);
      await sendMessage(targetGroupId, `🎮 נקבע! משחקים ביום ${dayHe}! (${result.winningDay.count} הצבעות)`);
    }

    return result;
  }

  if (result.isImpossible && getConfig().poll.auto_conclude_if_impossible) {
    pollRepo.expirePoll(poll.id);
    logger.info('Poll expired - impossible to reach threshold');

    try {
      const message = await generateNoGame(result.tallies);
      await sendMessage(targetGroupId, message);
    } catch (err) {
      logger.warn({ err }, 'Failed to generate AI no-game message, using default');
      await sendMessage(targetGroupId, '😢 לא היו מספיק הצבעות השבוע, אין משחק.');
    }

    return result;
  }

  return result;
}

export function getActivePollStatus(groupId?: string): PollResult | null {
  const poll = pollRepo.getActivePoll(groupId);
  if (!poll) return null;
  return analyzePoll(poll);
}
