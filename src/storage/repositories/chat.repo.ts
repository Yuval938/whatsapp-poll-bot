import { getDatabase } from '../database.js';

export interface ChatMessage {
  id: number;
  senderId: string;
  senderName: string | null;
  body: string;
  timestamp: Date;
  isFromBot: boolean;
}

export function insertChatMessage(senderId: string, senderName: string | null, body: string, isFromBot: boolean = false): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO chat_history (sender_id, sender_name, body, timestamp, is_from_bot)
    VALUES (?, ?, ?, ?, ?)
  `).run(senderId, senderName, body, new Date().toISOString(), isFromBot ? 1 : 0);
}

export function getRecentMessages(limit: number = 50): ChatMessage[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM chat_history ORDER BY timestamp DESC LIMIT ?
  `).all(limit) as any[];

  return rows.reverse().map(row => ({
    id: row.id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    body: row.body,
    timestamp: new Date(row.timestamp),
    isFromBot: row.is_from_bot === 1,
  }));
}

export function pruneOldMessages(daysToKeep: number = 7): number {
  const db = getDatabase();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToKeep);
  const result = db.prepare('DELETE FROM chat_history WHERE timestamp < ?').run(cutoff.toISOString());
  return result.changes;
}