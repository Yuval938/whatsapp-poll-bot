import { generate } from './provider.js';
import { buildSystemPrompt } from './personality.js';
import { getConfig } from '../config/index.js';
import { dayNameToHe } from '../utils/date.js';
import type { VoteTally } from '../poll/types.js';

export async function generatePollAnnouncement(groupId?: string): Promise<string> {
  const system = buildSystemPrompt(groupId);
  const prompt = [
    'Write a short opening message for a new weekly game-night poll in a WhatsApp friends group.',
    'Output language: Hebrew only.',
    'Tone: casual, playful, friendly.',
    'Length: 1-2 short sentences max.',
    'Do not include the poll options list in this message.'
  ].join('\n');

  return generate(system, prompt, getConfig().personality.max_response_tokens);
}

export async function generateGameConfirmed(day: string, voters: string[]): Promise<string> {
  const dayHe = dayNameToHe(day);
  const system = buildSystemPrompt();
  const prompt = [
    `Game day is confirmed on: ${dayHe}.`,
    `Voters: ${voters.join(', ') || 'N/A'}.`,
    'Write a short celebratory confirmation for the group in Hebrew.',
    'Length: 1-2 short sentences.'
  ].join('\n');

  return generate(system, prompt, getConfig().personality.max_response_tokens);
}

export async function generateNoGame(tallies: VoteTally[]): Promise<string> {
  const system = buildSystemPrompt();
  const tallySummary = tallies.map(t => `${dayNameToHe(t.day)}: ${t.count}`).join(', ');
  const prompt = [
    `No day reached the threshold (${getConfig().poll.vote_threshold}) this week.`,
    `Current tallies: ${tallySummary || 'No votes'}.`,
    'Write a short humorous/sad announcement in Hebrew that there is no game this week.',
    'Length: 1-2 short sentences.'
  ].join('\n');

  return generate(system, prompt, getConfig().personality.max_response_tokens);
}

export async function generateReminder(voterCount: number, tallies: VoteTally[]): Promise<string> {
  const system = buildSystemPrompt();
  const tallySummary = tallies.map(t => `${dayNameToHe(t.day)}: ${t.count}`).join(', ');
  const prompt = [
    `Only ${voterCount} people voted so far.`,
    `Current tallies: ${tallySummary || 'No votes yet'}.`,
    `Need ${getConfig().poll.vote_threshold} votes on one day to confirm.`,
    'Write a short nagging/funny reminder in Hebrew to vote.',
    'Length: 1-2 short sentences.'
  ].join('\n');

  return generate(system, prompt, getConfig().personality.max_response_tokens);
}

export async function generateMentionResponse(userMessage: string, groupId?: string): Promise<string> {
  const system = buildSystemPrompt(groupId);
  return generate(system, userMessage, getConfig().personality.max_response_tokens);
}
