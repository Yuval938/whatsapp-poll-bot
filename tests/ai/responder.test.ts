import { describe, it, expect } from 'vitest';
import { parseCommand } from '../../src/ai/responder.js';

describe('parseCommand', () => {
  it('should detect Hebrew create poll command', () => {
    expect(parseCommand('@GameBot צור הצבעה')).not.toBeNull();
    expect(parseCommand('צור הצבעה בבקשה')).not.toBeNull();
    expect(parseCommand('@bot פתח הצבעה')).not.toBeNull();
    expect(parseCommand('הצבעה חדשה')).not.toBeNull();
  });

  it('should detect English create poll command', () => {
    expect(parseCommand('@GameBot create poll')).not.toBeNull();
    expect(parseCommand('Create Poll please')).not.toBeNull();
  });

  it('should detect status command', () => {
    expect(parseCommand('@GameBot סטטוס')).not.toBeNull();
    expect(parseCommand('מצב')).not.toBeNull();
    expect(parseCommand('תוצאות')).not.toBeNull();
    expect(parseCommand('@bot status')).not.toBeNull();
    expect(parseCommand('results')).not.toBeNull();
  });

  it('should detect help command', () => {
    expect(parseCommand('@GameBot עזרה')).not.toBeNull();
    expect(parseCommand('help')).not.toBeNull();
  });

  it('should return null for non-command messages', () => {
    expect(parseCommand('מה קורה?')).toBeNull();
    expect(parseCommand('מתי המשחק?')).toBeNull();
    expect(parseCommand('hello world')).toBeNull();
  });
});