import { getLogger } from '../utils/logger.js';
import { createWeeklyPoll, getActivePollStatus } from '../poll/manager.js';
import { formatTallies } from '../poll/analyzer.js';
import { dayNameToHe } from '../utils/date.js';
import { generateMentionResponse } from './prompts.js';
import { sendReply } from '../whatsapp/actions.js';
import { getState } from '../storage/repositories/state.repo.js';

const COMMANDS: Array<{ patterns: RegExp[]; handler: (chatId: string, msgId: string) => Promise<string> }> = [
  {
    patterns: [
      /^(?:\u05e6\u05d5\u05e8\s+\u05d4\u05e6\u05d1\u05e2\u05d4|\u05e4\u05ea\u05d7\s+\u05d4\u05e6\u05d1\u05e2\u05d4|\u05d4\u05e6\u05d1\u05e2\u05d4\s+\u05d7\u05d3\u05e9\u05d4)(?:\s+\u05d1\u05d1\u05e7\u05e9\u05d4)?[!?.,]*$/,
      /^(?:create\s+poll)(?:\s+please)?[!?.,]*$/i,
    ],
    handler: async (chatId: string) => {
      const poll = await createWeeklyPoll(chatId);
      return poll ? '\u05d4\u05e6\u05d1\u05e2\u05d4 \u05d7\u05d3\u05e9\u05d4 \u05e0\u05d5\u05e6\u05e8\u05d4! \ud83c\udfae' : '\u05dc\u05d0 \u05d4\u05e6\u05dc\u05d7\u05ea\u05d9 \u05dc\u05d9\u05e6\u05d5\u05e8 \u05d4\u05e6\u05d1\u05e2\u05d4 \ud83d\ude15';
    },
  },
  {
    patterns: [
      /^(?:\u05e1\u05d8\u05d8\u05d5\u05e1|\u05de\u05e6\u05d1|\u05ea\u05d5\u05e6\u05d0\u05d5\u05ea)(?:\s+\u05d1\u05d1\u05e7\u05e9\u05d4)?[!?.,]*$/,
      /^(?:status|results)(?:\s+please)?[!?.,]*$/i,
    ],
    handler: async (chatId: string) => {
      const result = getActivePollStatus(chatId);
      if (!result) return '\u05d0\u05d9\u05df \u05d4\u05e6\u05d1\u05e2\u05d4 \u05e4\u05e2\u05d9\u05dc\u05d4 \u05db\u05e8\u05d2\u05e2.';
      const talliesStr = formatTallies(result.tallies, dayNameToHe);

      const lastPollAck = getState(`delivery:last_poll_ack:${chatId}`) ?? 'unknown';
      const lastCreatePollRun = getState('job:create-poll:last_finished_at') ?? 'unknown';

      return `\ud83d\udcca \u05de\u05e6\u05d1 \u05d4\u05d4\u05e6\u05d1\u05e2\u05d4:\n\u05e1\u05d4"\u05db ${result.totalVoters} \u05d4\u05e6\u05d1\u05d9\u05e2\u05d5\n${talliesStr}\n\n\ud83e\ude7a \u05d1\u05e8\u05d9\u05d0\u05d5\u05ea \u05d1\u05d5\u05d8:\nlast poll ack: ${lastPollAck}\nlast create-poll job: ${lastCreatePollRun}`;
    },
  },
  {
    patterns: [
      /^(?:\u05e2\u05d6\u05e8\u05d4)(?:\s+\u05d1\u05d1\u05e7\u05e9\u05d4)?[!?.,]*$/,
      /^(?:help)(?:\s+please)?[!?.,]*$/i,
      /^(?:health)(?:\s+please)?[!?.,]*$/i,
      /^(?:\u05d1\u05e8\u05d9\u05d0\u05d5\u05ea)(?:\s+\u05d1\u05d1\u05e7\u05e9\u05d4)?[!?.,]*$/,
    ],
    handler: async (chatId: string) => {
      const lastPollAck = getState(`delivery:last_poll_ack:${chatId}`) ?? 'unknown';
      const lastCreatePollRun = getState('job:create-poll:last_finished_at') ?? 'unknown';
      const lastReminderRun = getState('job:send-reminder:last_finished_at') ?? 'unknown';
      return `\ud83e\udd16 \u05e4\u05e7\u05d5\u05d3\u05d5\u05ea \u05d6\u05de\u05d9\u05e0\u05d5\u05ea:\n\u2022 \u05e6\u05d5\u05e8 \u05d4\u05e6\u05d1\u05e2\u05d4 - \u05e4\u05d5\u05ea\u05d7 \u05d4\u05e6\u05d1\u05e2\u05d4 \u05d7\u05d3\u05e9\u05d4\n\u2022 \u05e1\u05d8\u05d8\u05d5\u05e1 - \u05de\u05e6\u05d9\u05d2 \u05d0\u05ea \u05de\u05e6\u05d1 \u05d4\u05d4\u05e6\u05d1\u05e2\u05d4\n\u2022 \u05e2\u05d6\u05e8\u05d4 / health - \u05e2\u05d6\u05e8\u05d4 \u05d5\u05de\u05e6\u05d1 \u05d1\u05d5\u05d8\n\u2022 \u05db\u05dc \u05e9\u05d0\u05dc\u05d4 \u05d0\u05d7\u05e8\u05ea - \u05d0\u05e2\u05e0\u05d4 \u05d1\u05e2\u05d6\u05e8\u05ea AI\n\n\ud83e\ude7a Health:\nlast poll ack: ${lastPollAck}\nlast create-poll: ${lastCreatePollRun}\nlast reminder: ${lastReminderRun}`;
    },
  },
];

function stripMentionPrefix(text: string): string {
  return text.replace(/^@\S+\s*/, '').trim();
}

export async function handleMention(chatId: string, messageId: string, messageBody: string, senderId: string): Promise<void> {
  const logger = getLogger();
  const cleanBody = stripMentionPrefix(messageBody);
  logger.info({ senderId, body: cleanBody }, 'Handling mention');

  for (const cmd of COMMANDS) {
    for (const pattern of cmd.patterns) {
      if (pattern.test(cleanBody)) {
        const response = await cmd.handler(chatId, messageId);
        await sendReply(chatId, messageId, response);
        return;
      }
    }
  }

  try {
    const response = await generateMentionResponse(cleanBody, chatId);
    await sendReply(chatId, messageId, response);
  } catch (err) {
    logger.error({ err }, 'AI response generation failed');
    await sendReply(chatId, messageId, '\u05e1\u05dc\u05d9\u05d7\u05d4, \u05de\u05e9\u05d4\u05d5 \u05d4\u05e9\u05ea\u05d1\u05e9 \ud83d\ude05');
  }
}

export function parseCommand(text: string): string | null {
  const cleanBody = stripMentionPrefix(text);
  for (const cmd of COMMANDS) {
    for (const pattern of cmd.patterns) {
      if (pattern.test(cleanBody)) {
        return pattern.source;
      }
    }
  }
  return null;
}
