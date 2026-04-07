import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initDatabase, closeDatabase, resetDatabase } from '../../src/storage/database.js';
import { loadConfig, loadEnv, resetConfig } from '../../src/config/index.js';
import { initLogger } from '../../src/utils/logger.js';
import * as pollRepo from '../../src/storage/repositories/poll.repo.js';
import { resolve } from 'path';
import { existsSync, unlinkSync } from 'fs';

const TEST_DB = resolve(process.cwd(), 'data', 'test-manager.db');

// Mock whatsapp actions and AI
vi.mock('../../src/whatsapp/actions.js', () => ({
  sendPoll: vi.fn().mockResolvedValue('mock-wa-msg-id'),
  sendMessage: vi.fn().mockResolvedValue('mock-wa-msg-id'),
  sendReply: vi.fn().mockResolvedValue('mock-wa-msg-id'),
}));

vi.mock('../../src/ai/prompts.js', () => ({
  generatePollAnnouncement: vi.fn().mockResolvedValue('🎮 הצבעה חדשה!'),
  generateGameConfirmed: vi.fn().mockResolvedValue('🎉 משחקים!'),
  generateNoGame: vi.fn().mockResolvedValue('😢 אין משחק'),
  generateReminder: vi.fn().mockResolvedValue('📢 תצביעו!'),
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

describe('poll repository', () => {
  it('should enforce single active poll', () => {
    pollRepo.createPoll({
      waMessageId: 'wa-1', pollName: 'Poll 1', options: ['Monday'],
      createdAt: new Date(), deadline: new Date(Date.now() + 86400000),
    });

    const active1 = pollRepo.getActivePoll();
    expect(active1).not.toBeNull();

    // Expire and create new
    pollRepo.expireAllActivePolls();
    pollRepo.createPoll({
      waMessageId: 'wa-2', pollName: 'Poll 2', options: ['Tuesday'],
      createdAt: new Date(), deadline: new Date(Date.now() + 86400000),
    });

    const active2 = pollRepo.getActivePoll();
    expect(active2?.pollName).toBe('Poll 2');
  });

  it('should conclude a poll with a winning day', () => {
    const poll = pollRepo.createPoll({
      waMessageId: 'wa-1', pollName: 'Test', options: ['Monday'],
      createdAt: new Date(), deadline: new Date(Date.now() + 86400000),
    });

    pollRepo.concludePoll(poll.id, 'Monday');
    const concluded = pollRepo.getActivePoll();
    expect(concluded).toBeNull(); // No longer active
  });

  it('should look up poll by WA message ID', () => {
    const poll = pollRepo.createPoll({
      waMessageId: 'unique-wa-id', pollName: 'Test', options: ['Monday'],
      createdAt: new Date(), deadline: new Date(Date.now() + 86400000),
    });

    const found = pollRepo.getPollByWaMessageId('unique-wa-id');
    expect(found?.id).toBe(poll.id);

    const notFound = pollRepo.getPollByWaMessageId('nonexistent');
    expect(notFound).toBeNull();
  });
});