import { getLogger } from '../utils/logger.js';
import { createWeeklyPoll, getActivePollStatus } from '../poll/manager.js';
import { formatTallies } from '../poll/analyzer.js';
import { dayNameToHe } from '../utils/date.js';
import { generateMentionResponse } from './prompts.js';
import { sendReply } from '../whatsapp/actions.js';

// Command patterns (Hebrew + English), tuned to avoid false positives from regular chat.
const COMMANDS: Array<{ patterns: RegExp[]; handler: (chatId: string, msgId: string) => Promise<string> }> = [
  {
    patterns: [
      /^(?:צור\s+הצבעה|פתח\s+הצבעה|הצבעה\s+חדשה)(?:\s+בבקשה)?[!?.,]*$/,
      /^(?:create\s+poll)(?:\s+please)?[!?.,]*$/i,
    ],
    handler: async () => {
      const poll = await createWeeklyPoll();
      return poll ? 'הצבעה חדשה נוצרה! 🎮' : 'לא הצלחתי ליצור הצבעה 😕';
    },
  },
  {
    patterns: [
      /^(?:סטטוס|מצב|תוצאות)(?:\s+בבקשה)?[!?.,]*$/,
      /^(?:status|results)(?:\s+please)?[!?.,]*$/i,
    ],
    handler: async () => {
      const result = getActivePollStatus();
      if (!result) return 'אין הצבעה פעילה כרגע.';
      const talliesStr = formatTallies(result.tallies, dayNameToHe);
      return `📊 מצב ההצבעה:\nסה"כ ${result.totalVoters} הצביעו\n${talliesStr}`;
    },
  },
  {
    patterns: [/^(?:עזרה)(?:\s+בבקשה)?[!?.,]*$/, /^(?:help)(?:\s+please)?[!?.,]*$/i],
    handler: async () => {
      return `🤖 פקודות זמינות:
• צור הצבעה - פותח הצבעה חדשה
• סטטוס - מציג את מצב ההצבעה
• עזרה - מציג את ההודעה הזו
• כל שאלה אחרת - אענה בעזרת AI`;
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
    const response = await generateMentionResponse(cleanBody);
    await sendReply(chatId, messageId, response);
  } catch (err) {
    logger.error({ err }, 'AI response generation failed');
    await sendReply(chatId, messageId, 'סליחה, משהו השתבש 😅');
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
