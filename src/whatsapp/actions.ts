import { getClient } from './client.js';
import { getLogger } from '../utils/logger.js';
import { getEnv } from '../config/index.js';
import { setState } from '../storage/repositories/state.repo.js';

async function waitForAck(messageId: string, timeoutMs: number = 30000): Promise<number | null> {
  const client = getClient() as any;
  if (typeof client.getMessageById !== 'function') return null;

  const start = Date.now();
  let lastAck: number | null = null;

  while (Date.now() - start < timeoutMs) {
    try {
      const msg = await client.getMessageById(messageId);
      if (msg && typeof msg.ack === 'number') {
        lastAck = msg.ack;
        if (msg.ack >= 1) return msg.ack;
      }
    } catch {
      // ignore transient fetch errors
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return lastAck;
}

export async function sendMessage(chatId: string, text: string): Promise<string> {
  const logger = getLogger();
  const client = getClient();
  const result = await client.sendMessage(chatId, text);
  const ack = await waitForAck(result.id._serialized, 15000);
  if (ack !== null) {
    setState(`delivery:last_text_ack:${chatId}`, String(ack));
    setState(`delivery:last_text_ack_at:${chatId}`, new Date().toISOString());
  }
  logger.debug({ chatId, text: text.substring(0, 100), ack }, 'Message sent');
  return result.id._serialized;
}

export async function sendPoll(
  chatId: string,
  pollName: string,
  options: string[],
  pollOptions: { allowMultipleAnswers?: boolean } = {}
): Promise<string> {
  const logger = getLogger();
  const client = getClient();
  const env = getEnv();

  try {
    const wweb = await import('whatsapp-web.js');
    const PollCtor = (wweb as any).Poll ?? (wweb as any).default?.Poll;
    if (!PollCtor) {
      throw new Error('Failed to load Poll export from whatsapp-web.js');
    }

    const messageSecret = Array.from({ length: 32 }, () => Math.floor(Math.random() * 256));
    const poll = new PollCtor(pollName, options, {
      allowMultipleAnswers: pollOptions.allowMultipleAnswers ?? true,
      messageSecret,
    } as any);

    const result = await client.sendMessage(chatId, poll);
    const ack = await waitForAck(result.id._serialized, 30000);

    if (ack !== null) {
      setState(`delivery:last_poll_ack:${chatId}`, String(ack));
      setState(`delivery:last_poll_ack_at:${chatId}`, new Date().toISOString());
    }

    if (ack !== null && ack < 1) {
      throw new Error(`Poll message not delivered (ack=${ack})`);
    }

    logger.info({ chatId, pollName, optionCount: options.length, ack }, 'Poll sent');
    return result.id._serialized;
  } catch (err) {
    // Fallback object-based poll simulation is only valid in DRY_RUN.
    if (!env.DRY_RUN) {
      throw err;
    }

    const pollObj = { type: 'poll', name: pollName, options, ...pollOptions };
    const result = await client.sendMessage(chatId, pollObj);
    logger.info({ chatId, pollName, optionCount: options.length }, 'Poll sent (mock/fallback)');
    return result.id._serialized;
  }
}

export async function sendReply(chatId: string, messageId: string, text: string): Promise<string> {
  const logger = getLogger();
  const client = getClient();
  const result = await client.sendMessage(chatId, text);
  const ack = await waitForAck(result.id._serialized, 15000);
  if (ack !== null) {
    setState(`delivery:last_reply_ack:${chatId}`, String(ack));
    setState(`delivery:last_reply_ack_at:${chatId}`, new Date().toISOString());
  }
  logger.debug({ chatId, messageId, text: text.substring(0, 100), ack }, 'Reply sent');
  return result.id._serialized;
}
