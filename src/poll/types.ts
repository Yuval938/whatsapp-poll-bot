export interface ActivePoll {
  id: string;
  groupId: string;
  waMessageId: string;
  pollName: string;
  options: string[];
  createdAt: Date;
  deadline: Date;
  status: 'active' | 'concluded' | 'expired';
  concludedDay?: string;
  concludedAt?: Date;
}

export interface StoredVote {
  id: string;
  pollId: string;
  voterId: string;
  voterName: string | null;
  selectedDays: string[];
  updatedAt: Date;
}

export interface VoteTally {
  day: string;
  count: number;
  voters: string[];
}

export interface PollResult {
  poll: ActivePoll;
  tallies: VoteTally[];
  totalVoters: number;
  winningDay: VoteTally | null;
  isThresholdMet: boolean;
  isImpossible: boolean;
}
