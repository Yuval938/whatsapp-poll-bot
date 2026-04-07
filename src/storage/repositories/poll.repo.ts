import { v4 as uuid } from 'uuid';
import { getDatabase } from '../database.js';
import type { ActivePoll } from '../../poll/types.js';

export function createPoll(poll: Omit<ActivePoll, 'id' | 'status' | 'concludedDay' | 'concludedAt'>): ActivePoll {
  const db = getDatabase();
  const id = uuid();
  db.prepare(`
    INSERT INTO polls (id, wa_message_id, poll_name, options, created_at, deadline, status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')
  `).run(
    id,
    poll.waMessageId,
    poll.pollName,
    JSON.stringify(poll.options),
    poll.createdAt.toISOString(),
    poll.deadline.toISOString()
  );
  return { ...poll, id, status: 'active' };
}

export function getActivePoll(): ActivePoll | null {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM polls WHERE status = 'active' LIMIT 1").get() as any;
  if (!row) return null;
  return rowToPoll(row);
}

export function getPollByWaMessageId(waMessageId: string): ActivePoll | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM polls WHERE wa_message_id = ?').get(waMessageId) as any;
  if (!row) return null;
  return rowToPoll(row);
}

export function concludePoll(pollId: string, concludedDay: string): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE polls SET status = 'concluded', concluded_day = ?, concluded_at = ? WHERE id = ?
  `).run(concludedDay, new Date().toISOString(), pollId);
}

export function expirePoll(pollId: string): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE polls SET status = 'expired', concluded_at = ? WHERE id = ?
  `).run(new Date().toISOString(), pollId);
}

export function expireAllActivePolls(): number {
  const db = getDatabase();
  const result = db.prepare(`
    UPDATE polls SET status = 'expired', concluded_at = ? WHERE status = 'active'
  `).run(new Date().toISOString());
  return result.changes;
}

function rowToPoll(row: any): ActivePoll {
  return {
    id: row.id,
    waMessageId: row.wa_message_id,
    pollName: row.poll_name,
    options: JSON.parse(row.options),
    createdAt: new Date(row.created_at),
    deadline: new Date(row.deadline),
    status: row.status,
    concludedDay: row.concluded_day ?? undefined,
    concludedAt: row.concluded_at ? new Date(row.concluded_at) : undefined,
  };
}