import cron from 'node-cron';
import { getConfig, getTargetGroupIds } from '../config/index.js';
import { getLogger } from '../utils/logger.js';
import { createPollJob } from './jobs/create-poll.js';
import { sendReminderJob } from './jobs/send-reminder.js';
import { checkVotesJob } from './jobs/check-votes.js';
import { deadlineJob } from './jobs/deadline.js';
import { pruneOldMessages } from '../storage/repositories/chat.repo.js';
import { setState } from '../storage/repositories/state.repo.js';

const tasks: cron.ScheduledTask[] = [];

async function runInstrumentedJob(jobName: string, handler: () => Promise<void>): Promise<void> {
  const startedAt = new Date().toISOString();
  setState(`job:${jobName}:last_started_at`, startedAt);
  try {
    await handler();
    setState(`job:${jobName}:last_status`, 'ok');
  } catch (err) {
    setState(`job:${jobName}:last_status`, 'error');
    throw err;
  } finally {
    setState(`job:${jobName}:last_finished_at`, new Date().toISOString());
  }
}

export function startScheduler(): void {
  const logger = getLogger();
  const config = getConfig();
  const tz = config.schedule.timezone;

  tasks.push(
    cron.schedule(config.schedule.poll_create_cron, async () => {
      logger.info('Cron: create-poll job firing');
      await runInstrumentedJob('create-poll', async () => {
        for (const groupId of getTargetGroupIds()) {
          await createPollJob(groupId);
        }
      }).catch(err => logger.error({ err }, 'create-poll job failed'));
    }, { timezone: tz })
  );

  tasks.push(
    cron.schedule(config.schedule.reminder_cron, async () => {
      logger.info('Cron: send-reminder job firing');
      await runInstrumentedJob('send-reminder', async () => {
        for (const groupId of getTargetGroupIds()) {
          await sendReminderJob(groupId);
        }
      }).catch(err => logger.error({ err }, 'send-reminder job failed'));
    }, { timezone: tz })
  );

  tasks.push(
    cron.schedule(config.schedule.vote_check_cron, async () => {
      logger.debug('Cron: check-votes job firing');
      await runInstrumentedJob('check-votes', async () => {
        for (const groupId of getTargetGroupIds()) {
          await checkVotesJob(groupId);
        }
      }).catch(err => logger.error({ err }, 'check-votes job failed'));
    }, { timezone: tz })
  );

  tasks.push(
    cron.schedule(config.schedule.poll_deadline_cron, async () => {
      logger.info('Cron: deadline job firing');
      await runInstrumentedJob('deadline', async () => {
        for (const groupId of getTargetGroupIds()) {
          await deadlineJob(groupId);
        }
      }).catch(err => logger.error({ err }, 'deadline job failed'));
    }, { timezone: tz })
  );

  tasks.push(
    cron.schedule('0 3 * * *', () => {
      const pruned = pruneOldMessages(7);
      setState('job:prune-chat:last_status', 'ok');
      setState('job:prune-chat:last_finished_at', new Date().toISOString());
      logger.info({ pruned }, 'Pruned old chat messages');
    }, { timezone: tz })
  );

  logger.info({ jobCount: tasks.length, groups: getTargetGroupIds().length }, 'Scheduler started');
}

export function stopScheduler(): void {
  for (const task of tasks) {
    task.stop();
  }
  tasks.length = 0;
  getLogger().info('Scheduler stopped');
}

export function scheduleJob(cronExpr: string, handler: () => Promise<void>, tz?: string): cron.ScheduledTask {
  const task = cron.schedule(cronExpr, handler, { timezone: tz });
  tasks.push(task);
  return task;
}
