import { v4 as uuid } from 'uuid';
import { getDatabase } from '../database.js';
import type { ActivePoll } from '../../poll/types.js';

export function createPoll(
  poll: Omit<ActivePoll, 'id' | 'status' | 'concludedDay' | 'concludedAt'> | (Omit<ActivePoll, 'id' | 'status' | 'concludedDay' | 'concludedAt' | 'groupId'> & { groupId?: string })
): ActivePoll {
  const db = getDatabase();
  const id = uuid();
  const groupId = (poll as any).groupId ?? '';
  db.prepare(`
    INSERT INTO polls (id, group_id, wa_message_id, poll_name, options, created_at, deadline, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
  `).run(
    id,
    groupId,
    poll.waMessageId,
    poll.pollName,
    JSON.stringify(poll.options),
    poll.createdAt.toISOString(),
    poll.deadline.toISOString()
  );
  return { ...poll, groupId, id, status: 'active' } as ActivePoll;
}

export function getActivePoll(groupId?: string): ActivePoll | null {
  const db = getDatabase();
  const row = groupId && groupId.length > 0
    ? db.prepare("SELECT * FROM polls WHERE status = 'active' AND group_id = ? LIMIT 1").get(groupId)
    : db.prepare("SELECT * FROM polls WHERE status = 'active' LIMIT 1").get();
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

export function expireAllActivePolls(groupId?: string): number {
  const db = getDatabase();
  const result = groupId && groupId.length > 0
    ? db.prepare(`
      UPDATE polls SET status = 'expired', concluded_at = ? WHERE status = 'active' AND group_id = ?
    `).run(new Date().toISOString(), groupId)
    : db.prepare(`
      UPDATE polls SET status = 'expired', concluded_at = ? WHERE status = 'active'
    `).run(new Date().toISOString());
  return result.changes;
}

function rowToPoll(row: any): ActivePoll {
  return {
    id: row.id,
    groupId: row.group_id ?? '',
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
