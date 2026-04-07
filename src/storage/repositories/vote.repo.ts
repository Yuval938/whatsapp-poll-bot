import { v4 as uuid } from 'uuid';
import { getDatabase } from '../database.js';
import type { StoredVote, VoteTally } from '../../poll/types.js';

export function upsertVote(pollId: string, voterId: string, voterName: string | null, selectedDays: string[]): StoredVote {
  const db = getDatabase();
  const id = uuid();
  const now = new Date().toISOString();
  const selectedDaysJson = JSON.stringify(selectedDays);

  db.prepare(`
    INSERT INTO votes (id, poll_id, voter_id, voter_name, selected_days, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(poll_id, voter_id) DO UPDATE SET
      selected_days = excluded.selected_days,
      voter_name = excluded.voter_name,
      updated_at = excluded.updated_at
  `).run(id, pollId, voterId, voterName, selectedDaysJson, now);

  return { id, pollId, voterId, voterName, selectedDays, updatedAt: new Date(now) };
}

export function getVotesForPoll(pollId: string): StoredVote[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM votes WHERE poll_id = ?').all(pollId) as any[];
  return rows.map(rowToVote);
}

export function getTalliesForPoll(pollId: string): VoteTally[] {
  const db = getDatabase();
  const votes = getVotesForPoll(pollId);

  const tallyMap = new Map<string, { count: number; voters: string[] }>();

  for (const vote of votes) {
    for (const day of vote.selectedDays) {
      if (!tallyMap.has(day)) {
        tallyMap.set(day, { count: 0, voters: [] });
      }
      const tally = tallyMap.get(day)!;
      tally.count++;
      tally.voters.push(vote.voterName ?? vote.voterId);
    }
  }

  return Array.from(tallyMap.entries())
    .map(([day, data]) => ({ day, count: data.count, voters: data.voters }))
    .sort((a, b) => b.count - a.count);
}

export function getUniqueVoterCount(pollId: string): number {
  const db = getDatabase();
  const row = db.prepare('SELECT COUNT(DISTINCT voter_id) as count FROM votes WHERE poll_id = ?').get(pollId) as any;
  return row?.count ?? 0;
}

function rowToVote(row: any): StoredVote {
  return {
    id: row.id,
    pollId: row.poll_id,
    voterId: row.voter_id,
    voterName: row.voter_name,
    selectedDays: JSON.parse(row.selected_days),
    updatedAt: new Date(row.updated_at),
  };
}