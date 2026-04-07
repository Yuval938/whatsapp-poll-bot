import cron from 'node-cron';
import { getConfig } from '../config/index.js';
import { getLogger } from '../utils/logger.js';
import { createPollJob } from './jobs/create-poll.js';
import { sendReminderJob } from './jobs/send-reminder.js';
import { checkVotesJob } from './jobs/check-votes.js';
import { deadlineJob } from './jobs/deadline.js';
import { pruneOldMessages } from '../storage/repositories/chat.repo.js';

const tasks: cron.ScheduledTask[] = [];

export function startScheduler(): void {
  const logger = getLogger();
  const config = getConfig();
  const tz = config.schedule.timezone;

  // Weekly poll creation (Sunday 7 PM)
  tasks.push(
    cron.schedule(config.schedule.poll_create_cron, async () => {
      logger.info('Cron: create-poll job firing');
      await createPollJob().catch(err => logger.error({ err }, 'create-poll job failed'));
    }, { timezone: tz })
  );

  // Reminder (Tuesday noon)
  tasks.push(
    cron.schedule(config.schedule.reminder_cron, async () => {
      logger.info('Cron: send-reminder job firing');
      await sendReminderJob().catch(err => logger.error({ err }, 'send-reminder job failed'));
    }, { timezone: tz })
  );

  // Fallback vote checker (every 30 min)
  tasks.push(
    cron.schedule(config.schedule.vote_check_cron, async () => {
      logger.debug('Cron: check-votes job firing');
      await checkVotesJob().catch(err => logger.error({ err }, 'check-votes job failed'));
    }, { timezone: tz })
  );

  // Poll deadline (Wednesday 8 PM)
  tasks.push(
    cron.schedule(config.schedule.poll_deadline_cron, async () => {
      logger.info('Cron: deadline job firing');
      await deadlineJob().catch(err => logger.error({ err }, 'deadline job failed'));
    }, { timezone: tz })
  );

  // Chat history cleanup (daily at 3 AM)
  tasks.push(
    cron.schedule('0 3 * * *', () => {
      const pruned = pruneOldMessages(7);
      logger.info({ pruned }, 'Pruned old chat messages');
    }, { timezone: tz })
  );

  logger.info({ jobCount: tasks.length }, 'Scheduler started');
}

export function stopScheduler(): void {
  for (const task of tasks) {
    task.stop();
  }
  tasks.length = 0;
  getLogger().info('Scheduler stopped');
}

// For testing: schedule with custom cron expressions
export function scheduleJob(cronExpr: string, handler: () => Promise<void>, tz?: string): cron.ScheduledTask {
  const task = cron.schedule(cronExpr, handler, { timezone: tz });
  tasks.push(task);
  return task;
}