import { getConfig } from '../config/index.js';
import { getRecentMessages } from '../storage/repositories/chat.repo.js';
import { getActivePollStatus } from '../poll/manager.js';
import { formatTallies } from '../poll/analyzer.js';
import { dayNameToHe } from '../utils/date.js';

export function buildSystemPrompt(groupId?: string): string {
  const config = getConfig();
  const parts: string[] = [];

  // Base personality text from config
  parts.push(config.personality.base_traits.trim());

  // Poll context
  const pollStatus = getActivePollStatus(groupId);
  if (pollStatus) {
    const talliesStr = formatTallies(pollStatus.tallies, dayNameToHe);
    parts.push('\n--- Current Poll Status ---');
    parts.push(`There is an active poll. Total voters: ${pollStatus.totalVoters}.`);
    parts.push(`Threshold to confirm: ${getConfig().poll.vote_threshold} votes.`);
    parts.push(talliesStr);
    if (pollStatus.isThresholdMet && pollStatus.winningDay) {
      parts.push(`Confirmed day: ${dayNameToHe(pollStatus.winningDay.day)}`);
    }
  } else {
    parts.push('\nNo active poll right now.');
  }

  // Recent chat context
  const recentMessages = getRecentMessages(config.personality.chat_history_window);
  if (recentMessages.length > 0) {
    parts.push('\n--- Recent Group Chat Context ---');
    for (const msg of recentMessages) {
      const sender = msg.senderName ?? msg.senderId;
      const prefix = msg.isFromBot ? `[${config.personality.bot_name}]` : `[${sender}]`;
      parts.push(`${prefix}: ${msg.body}`);
    }
  }

  // Behavioral guardrails
  parts.push('\n--- Behavior Rules ---');
  parts.push('- Always reply in Hebrew');
  parts.push('- Keep responses concise (usually up to 2-3 short sentences)');
  parts.push('- Do not invent facts');
  parts.push('- For poll-related questions, rely on actual poll data above');

  return parts.join('\n');
}
