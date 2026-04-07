import { getConfig } from '../config/index.js';
import { getTalliesForPoll, getUniqueVoterCount } from '../storage/repositories/vote.repo.js';
import type { ActivePoll, PollResult, VoteTally } from './types.js';

const MAX_GROUP_SIZE = 20; // Approximate group size for impossibility calculation

export function analyzePoll(poll: ActivePoll): PollResult {
  const config = getConfig();
  const threshold = config.poll.vote_threshold;
  const tallies = getTalliesForPoll(poll.id);
  const totalVoters = getUniqueVoterCount(poll.id);

  // Find the day with the most votes
  const winningDay = tallies.length > 0 ? tallies[0] : null; // Already sorted desc by count
  const isThresholdMet = winningDay !== null && winningDay.count >= threshold;

  // Check if it's mathematically impossible for any day to reach the threshold
  // Conservative: assume all remaining group members could still vote for any single day
  const remainingPotentialVoters = Math.max(0, MAX_GROUP_SIZE - totalVoters);
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
  if (tallies.length === 0) return 'אין הצבעות עדיין';

  return tallies
    .map(t => {
      const { dayNameToHe } = require('../utils/date.js');
      const dayHe = dayNameToHe(t.day);
      return `יום ${dayHe}: ${t.count} הצבעות (${t.voters.join(', ')})`;
    })
    .join('\n');
}

// Pure function version for testing (no imports from date.ts)
export function formatTallies(tallies: VoteTally[], dayFormatter: (day: string) => string = d => d): string {
  if (tallies.length === 0) return 'אין הצבעות עדיין';
  return tallies
    .map(t => `יום ${dayFormatter(t.day)}: ${t.count} הצבעות (${t.voters.join(', ')})`)
    .join('\n');
}