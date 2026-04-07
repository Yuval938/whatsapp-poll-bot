import { getLogger } from '../utils/logger.js';
import { getEnv } from '../config/index.js';
import { getBotId, type BotClient } from './client.js';
import { insertChatMessage } from '../storage/repositories/chat.repo.js';
import { handleVote } from '../poll/manager.js';
import { handleMention, parseCommand } from '../ai/responder.js';

export function registerEventHandlers(client: BotClient): void {
  const logger = getLogger();
  const env = getEnv();
  const groupId = env.WHATSAPP_GROUP_ID;

  // --- Handle incoming messages ---
  client.on('message', async (msg: any) => {
    try {
      // Only process messages from the target group
      const chatId = msg.from;
      if (chatId !== groupId) return;

      const senderId = msg.author ?? msg.from;
      const contact = await msg.getContact?.();
      const senderName = contact?.pushname ?? null;
      const body = msg.body ?? '';

      // Store in chat history (passive collection)
      if (body.trim()) {
        insertChatMessage(senderId, senderName, body, false);
      }

      // Check for @ mention of the bot
      const botId = getBotId();
      const mentionedIds: string[] = msg.mentionedIds ?? [];
      const isMentioned = mentionedIds.includes(botId);
      const isDirectCommand = parseCommand(body) !== null;

      if (isMentioned || isDirectCommand) {
        logger.info({ senderId, body }, 'Bot was mentioned');
        await handleMention(chatId, msg.id._serialized, body, senderId);
      }
    } catch (err) {
      logger.error({ err }, 'Error handling message event');
    }
  });

  // --- Handle poll vote updates ---
  client.on('vote_update', async (vote: any) => {
    try {
      const voterId = vote.voter;
      const selectedOptions: string[] = vote.selectedOptions ?? [];
      const pollMessageId = vote.parentMessage?.id?._serialized;

      if (!pollMessageId) {
        logger.warn('vote_update missing parent message ID');
        return;
      }

      const contact = await vote.getContact?.();
      const voterName = contact?.pushname ?? null;

      logger.info({ voterId, selectedOptions, pollMessageId }, 'Vote update received');
      await handleVote(pollMessageId, voterId, voterName, selectedOptions);
    } catch (err) {
      logger.error({ err }, 'Error handling vote_update event');
    }
  });

  logger.info('Event handlers registered');
}
