import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase, resetDatabase } from '../../src/storage/database.js';
import { loadConfig, loadEnv, resetConfig } from '../../src/config/index.js';
import { initLogger } from '../../src/utils/logger.js';
import * as pollRepo from '../../src/storage/repositories/poll.repo.js';
import * as voteRepo from '../../src/storage/repositories/vote.repo.js';
import { analyzePoll, formatTallies } from '../../src/poll/analyzer.js';
import { resolve } from 'path';
import { existsSync, unlinkSync } from 'fs';

const TEST_DB = resolve(process.cwd(), 'data', 'test-analyzer.db');

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

describe('analyzePoll', () => {
  it('should detect when threshold is met', () => {
    const poll = pollRepo.createPoll({
      waMessageId: 'wa-1',
      pollName: 'Test',
      options: ['Monday', 'Tuesday'],
      createdAt: new Date(),
      deadline: new Date(Date.now() + 86400000),
    });

    // Add 6 votes for Monday
    for (let i = 0; i < 6; i++) {
      voteRepo.upsertVote(poll.id, `voter-${i}`, `Voter ${i}`, ['Monday']);
    }

    const result = analyzePoll(poll);
    expect(result.isThresholdMet).toBe(true);
    expect(result.winningDay?.day).toBe('Monday');
    expect(result.winningDay?.count).toBe(6);
  });

  it('should not meet threshold with fewer votes', () => {
    const poll = pollRepo.createPoll({
      waMessageId: 'wa-2',
      pollName: 'Test',
      options: ['Monday', 'Tuesday'],
      createdAt: new Date(),
      deadline: new Date(Date.now() + 86400000),
    });

    for (let i = 0; i < 4; i++) {
      voteRepo.upsertVote(poll.id, `voter-${i}`, `Voter ${i}`, ['Monday']);
    }

    const result = analyzePoll(poll);
    expect(result.isThresholdMet).toBe(false);
    expect(result.totalVoters).toBe(4);
  });

  it('should handle votes split across multiple days', () => {
    const poll = pollRepo.createPoll({
      waMessageId: 'wa-3',
      pollName: 'Test',
      options: ['Monday', 'Tuesday', 'Wednesday'],
      createdAt: new Date(),
      deadline: new Date(Date.now() + 86400000),
    });

    voteRepo.upsertVote(poll.id, 'v1', 'V1', ['Monday', 'Tuesday']);
    voteRepo.upsertVote(poll.id, 'v2', 'V2', ['Tuesday', 'Wednesday']);
    voteRepo.upsertVote(poll.id, 'v3', 'V3', ['Tuesday']);

    const result = analyzePoll(poll);
    expect(result.tallies[0].day).toBe('Tuesday');
    expect(result.tallies[0].count).toBe(3);
    expect(result.totalVoters).toBe(3);
  });

  it('should handle vote updates (upsert)', () => {
    const poll = pollRepo.createPoll({
      waMessageId: 'wa-4',
      pollName: 'Test',
      options: ['Monday', 'Tuesday'],
      createdAt: new Date(),
      deadline: new Date(Date.now() + 86400000),
    });

    voteRepo.upsertVote(poll.id, 'v1', 'V1', ['Monday']);
    voteRepo.upsertVote(poll.id, 'v1', 'V1', ['Tuesday']); // Changed vote

    const result = analyzePoll(poll);
    expect(result.totalVoters).toBe(1);
    const mondayTally = result.tallies.find(t => t.day === 'Monday');
    const tuesdayTally = result.tallies.find(t => t.day === 'Tuesday');
    expect(mondayTally).toBeUndefined();
    expect(tuesdayTally?.count).toBe(1);
  });

  it('should return empty tallies when no votes', () => {
    const poll = pollRepo.createPoll({
      waMessageId: 'wa-5',
      pollName: 'Test',
      options: ['Monday'],
      createdAt: new Date(),
      deadline: new Date(Date.now() + 86400000),
    });

    const result = analyzePoll(poll);
    expect(result.tallies).toHaveLength(0);
    expect(result.totalVoters).toBe(0);
    expect(result.isThresholdMet).toBe(false);
  });
});

describe('formatTallies', () => {
  it('should format empty tallies', () => {
    expect(formatTallies([])).toBe('אין הצבעות עדיין');
  });

  it('should format tallies with custom formatter', () => {
    const tallies = [
      { day: 'Monday', count: 3, voters: ['Alice', 'Bob', 'Charlie'] },
      { day: 'Tuesday', count: 1, voters: ['Dave'] },
    ];
    const result = formatTallies(tallies, d => `[${d}]`);
    expect(result).toContain('[Monday]');
    expect(result).toContain('3 הצבעות');
    expect(result).toContain('Alice, Bob, Charlie');
  });
});