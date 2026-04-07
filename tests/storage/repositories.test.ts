import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase, resetDatabase } from '../../src/storage/database.js';
import { loadConfig, loadEnv, resetConfig } from '../../src/config/index.js';
import { initLogger } from '../../src/utils/logger.js';
import * as chatRepo from '../../src/storage/repositories/chat.repo.js';
import * as voteRepo from '../../src/storage/repositories/vote.repo.js';
import * as pollRepo from '../../src/storage/repositories/poll.repo.js';
import { resolve } from 'path';
import { existsSync, unlinkSync } from 'fs';

const TEST_DB = resolve(process.cwd(), 'data', 'test-repos.db');

beforeEach(() => {
  resetConfig();
  resetDatabase();
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  loadConfig();
  loadEnv();
  initLogger('silent');
  initDatabase(TEST_DB);
});

afterEach(() => {
  closeDatabase();
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
});

describe('chat repository', () => {
  it('should insert and retrieve messages', () => {
    chatRepo.insertChatMessage('user1', 'Alice', 'Hello!', false);
    chatRepo.insertChatMessage('user2', 'Bob', 'Hi there!', false);
    chatRepo.insertChatMessage('bot', 'GameBot', 'Hey!', true);

    const messages = chatRepo.getRecentMessages(10);
    expect(messages).toHaveLength(3);
    expect(messages[0].senderName).toBe('Alice');
    expect(messages[2].isFromBot).toBe(true);
  });

  it('should respect limit parameter', () => {
    for (let i = 0; i < 10; i++) {
      chatRepo.insertChatMessage(`user${i}`, `User${i}`, `Message ${i}`, false);
    }
    const messages = chatRepo.getRecentMessages(3);
    expect(messages).toHaveLength(3);
  });

  it('should return messages in chronological order', () => {
    chatRepo.insertChatMessage('u1', 'A', 'First', false);
    chatRepo.insertChatMessage('u2', 'B', 'Second', false);
    const msgs = chatRepo.getRecentMessages(10);
    expect(msgs[0].body).toBe('First');
    expect(msgs[1].body).toBe('Second');
  });
});

describe('vote repository', () => {
  it('should upsert votes correctly', () => {
    const poll = pollRepo.createPoll({
      waMessageId: 'wa-1', pollName: 'Test', options: ['Monday', 'Tuesday'],
      createdAt: new Date(), deadline: new Date(Date.now() + 86400000),
    });

    voteRepo.upsertVote(poll.id, 'voter1', 'Alice', ['Monday']);
    voteRepo.upsertVote(poll.id, 'voter1', 'Alice', ['Tuesday']); // Update

    const votes = voteRepo.getVotesForPoll(poll.id);
    expect(votes).toHaveLength(1);
    expect(votes[0].selectedDays).toEqual(['Tuesday']);
  });

  it('should count unique voters', () => {
    const poll = pollRepo.createPoll({
      waMessageId: 'wa-1', pollName: 'Test', options: ['Monday'],
      createdAt: new Date(), deadline: new Date(Date.now() + 86400000),
    });

    voteRepo.upsertVote(poll.id, 'v1', 'A', ['Monday']);
    voteRepo.upsertVote(poll.id, 'v2', 'B', ['Monday']);
    voteRepo.upsertVote(poll.id, 'v1', 'A', ['Monday']); // Re-vote

    expect(voteRepo.getUniqueVoterCount(poll.id)).toBe(2);
  });

  it('should compute tallies correctly', () => {
    const poll = pollRepo.createPoll({
      waMessageId: 'wa-1', pollName: 'Test', options: ['Monday', 'Tuesday', 'Wednesday'],
      createdAt: new Date(), deadline: new Date(Date.now() + 86400000),
    });

    voteRepo.upsertVote(poll.id, 'v1', 'A', ['Monday', 'Wednesday']);
    voteRepo.upsertVote(poll.id, 'v2', 'B', ['Monday']);
    voteRepo.upsertVote(poll.id, 'v3', 'C', ['Wednesday']);

    const tallies = voteRepo.getTalliesForPoll(poll.id);
    // Monday: 2 (A, B), Wednesday: 2 (A, C)
    expect(tallies[0].count).toBe(2);
    expect(tallies[1].count).toBe(2);
  });
});