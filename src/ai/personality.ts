import { getConfig } from '../config/index.js';
import { getRecentMessages } from '../storage/repositories/chat.repo.js';
import { getActivePollStatus } from '../poll/manager.js';
import { formatTallies } from '../poll/analyzer.js';
import { dayNameToHe } from '../utils/date.js';

export function buildSystemPrompt(): string {
  const config = getConfig();
  const parts: string[] = [];

  // Base personality
  parts.push(config.personality.base_traits.trim());

  // Current poll context
  const pollStatus = getActivePollStatus();
  if (pollStatus) {
    const talliesStr = formatTallies(pollStatus.tallies, dayNameToHe);
    parts.push(`\n--- מצב ההצבעה הנוכחי ---`);
    parts.push(`יש הצבעה פעילה. סה"כ ${pollStatus.totalVoters} אנשים הצביעו.`);
    parts.push(`סף להחלטה: ${getConfig().poll.vote_threshold} הצבעות.`);
    parts.push(talliesStr);
    if (pollStatus.isThresholdMet && pollStatus.winningDay) {
      parts.push(`נקבע יום משחק: ${dayNameToHe(pollStatus.winningDay.day)}`);
    }
  } else {
    parts.push(`\nאין הצבעה פעילה כרגע.`);
  }

  // Recent chat context
  const recentMessages = getRecentMessages(config.personality.chat_history_window);
  if (recentMessages.length > 0) {
    parts.push(`\n--- שיחה אחרונה בקבוצה ---`);
    for (const msg of recentMessages) {
      const sender = msg.senderName ?? msg.senderId;
      const prefix = msg.isFromBot ? `[${config.personality.bot_name}]` : `[${sender}]`;
      parts.push(`${prefix}: ${msg.body}`);
    }
  }

  // Behavioral guardrails
  parts.push(`\n--- הנחיות ---`);
  parts.push(`- ענה תמיד בעברית`);
  parts.push(`- תהיה קצר וקולע (לא יותר מ-2-3 משפטים)`);
  parts.push(`- אל תמציא מידע שאתה לא יודע`);
  parts.push(`- אם שואלים על ההצבעה, תן מידע מדויק מהנתונים למעלה`);

  return parts.join('\n');
}