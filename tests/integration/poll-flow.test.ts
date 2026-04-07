import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initDatabase, closeDatabase, resetDatabase } from '../../src/storage/database.js';
import { loadConfig, loadEnv, resetConfig } from '../../src/config/index.js';
import { initLogger } from '../../src/utils/logger.js';
import * as pollRepo from '../../src/storage/repositories/poll.repo.js';
import * as voteRepo from '../../src/storage/repositories/vote.repo.js';
import { analyzePoll } from '../../src/poll/analyzer.js';
import { resolve } from 'path';
import { existsSync, unlinkSync } from 'fs';

const TEST_DB = resolve(process.cwd(), 'data', 'test-integration.db');

// Mock external dependencies
vi.mock('../../src/whatsapp/actions.js', () => ({
  sendPoll: vi.fn().mockResolvedValue('mock-poll-wa-id'),
  sendMessage: vi.fn().mockResolvedValue('mock-msg-id'),
  sendReply: vi.fn().mockResolvedValue('mock-reply-id'),
}));

vi.mock('../../src/ai/prompts.js', () => ({
  generatePollAnnouncement: vi.fn().mockResolvedValue('🎮 Vote!'),
  generateGameConfirmed: vi.fn().mockResolvedValue('🎉 Game on!'),
  generateNoGame: vi.fn().mockResolvedValue('😢 No game'),
  generateReminder: vi.fn().mockResolvedValue('📢 Vote!'),
}));

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

describe('Full poll flow integration', () => {
  it('should: create poll → receive votes → detect threshold → conclude', () => {
    // Step 1: Create poll
    const poll = pollRepo.createPoll({
      waMessageId: 'integration-wa-1',
      pollName: 'מתי משחקים?',
      options: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      createdAt: new Date(),
      deadline: new Date(Date.now() + 3 * 86400000),
    });

    expect(poll.status).toBe('active');
    expect(pollRepo.getActivePoll()?.id).toBe(poll.id);

    // Step 2: Simulate votes (not yet at threshold)
    for (let i = 0; i < 4; i++) {
      voteRepo.upsertVote(poll.id, `voter-${i}`, `Player${i}`, ['Monday']);
    }
    voteRepo.upsertVote(poll.id, 'voter-4', 'Player4', ['Tuesday']);

    let result = analyzePoll(poll);
    expect(result.isThresholdMet).toBe(false);
    expect(result.totalVoters).toBe(5);
    expect(result.tallies[0].day).toBe('Monday');
    expect(result.tallies[0].count).toBe(4);

    // Step 3: Add more votes to reach threshold
    voteRepo.upsertVote(poll.id, 'voter-5', 'Player5', ['Monday']);
    voteRepo.upsertVote(poll.id, 'voter-6', 'Player6', ['Monday']);

    result = analyzePoll(poll);
    expect(result.isThresholdMet).toBe(true);
    expect(result.winningDay?.day).toBe('Monday');
    expect(result.winningDay?.count).toBe(6);
    expect(result.winningDay?.voters).toContain('Player5');

    // Step 4: Conclude
    pollRepo.concludePoll(poll.id, 'Monday');
    expect(pollRepo.getActivePoll()).toBeNull();
  });

  it('should handle poll expiration when deadline passes', () => {
    const poll = pollRepo.createPoll({
      waMessageId: 'integration-wa-2',
      pollName: 'Test',
      options: ['Monday'],
      createdAt: new Date(),
      deadline: new Date(Date.now() - 1000), // Already past
    });

    // Only 2 votes — not enough
    voteRepo.upsertVote(poll.id, 'v1', 'A', ['Monday']);
    voteRepo.upsertVote(poll.id, 'v2', 'B', ['Monday']);

    const result = analyzePoll(poll);
    expect(result.isThresholdMet).toBe(false);

    // Expire
    pollRepo.expirePoll(poll.id);
    expect(pollRepo.getActivePoll()).toBeNull();
  });

  it('should expire old poll when creating new one', () => {
    const poll1 = pollRepo.createPoll({
      waMessageId: 'wa-old', pollName: 'Old',
      options: ['Monday'], createdAt: new Date(), deadline: new Date(Date.now() + 86400000),
    });

    expect(pollRepo.getActivePoll()?.id).toBe(poll1.id);

    // Expire all and create new
    const expired = pollRepo.expireAllActivePolls();
    expect(expired).toBe(1);

    const poll2 = pollRepo.createPoll({
      waMessageId: 'wa-new', pollName: 'New',
      options: ['Tuesday'], createdAt: new Date(), deadline: new Date(Date.now() + 86400000),
    });

    expect(pollRepo.getActivePoll()?.id).toBe(poll2.id);
  });
});