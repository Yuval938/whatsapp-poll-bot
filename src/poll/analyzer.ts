import { getConfig, getEnv } from '../config/index.js';
import { getTalliesForPoll, getUniqueVoterCount } from '../storage/repositories/vote.repo.js';
import type { ActivePoll, PollResult, VoteTally } from './types.js';

export function analyzePoll(poll: ActivePoll): PollResult {
  const config = getConfig();
  const env = getEnv();
  const threshold = config.poll.vote_threshold;
  const tallies = getTalliesForPoll(poll.id);
  const totalVoters = getUniqueVoterCount(poll.id);

  const winningDay = tallies.length > 0 ? tallies[0] : null;
  const isThresholdMet = winningDay !== null && winningDay.count >= threshold;

  // Conservative impossibility check based on estimated group size.
  const maxGroupSize = env.GROUP_SIZE_ESTIMATE;
  const remainingPotentialVoters = Math.max(0, maxGroupSize - totalVoters);
  const bestPossible = (winningDay?.count ?? 0) + remainingPotentialVoters;
  const isImpossible = bestPossible < threshold && totalVoters > 0;

  return {
    poll,
    tallies,
    totalVoters,
    winningDay,
    isThresholdMet,
    isImpossible,
  };
}

export function formatTalliesHe(tallies: VoteTally[]): string {
  if (tallies.length === 0) return '\u05d0\u05d9\u05df \u05d4\u05e6\u05d1\u05e2\u05d5\u05ea \u05e2\u05d3\u05d9\u05d9\u05df';

  return tallies
    .map(t => {
      const { dayNameToHe } = require('../utils/date.js');
      const dayHe = dayNameToHe(t.day);
      return `\u05d9\u05d5\u05dd ${dayHe}: ${t.count} \u05d4\u05e6\u05d1\u05e2\u05d5\u05ea (${t.voters.join(', ')})`;
    })
    .join('\n');
}

export function formatTallies(tallies: VoteTally[], dayFormatter: (day: string) => string = d => d): string {
  if (tallies.length === 0) return '\u05d0\u05d9\u05df \u05d4\u05e6\u05d1\u05e2\u05d5\u05ea \u05e2\u05d3\u05d9\u05d9\u05df';
  return tallies
    .map(t => `\u05d9\u05d5\u05dd ${dayFormatter(t.day)}: ${t.count} \u05d4\u05e6\u05d1\u05e2\u05d5\u05ea (${t.voters.join(', ')})`)
    .join('\n');
}
