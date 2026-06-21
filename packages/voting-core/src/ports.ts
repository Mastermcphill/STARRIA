// ---------------------------------------------------------------------------
// voting-core — ports
// ---------------------------------------------------------------------------

import type { WeightedVote, VoteTally, FraudCheckInput, FraudCheckResult } from './types';

export interface VoteStorePort {
  save(vote: WeightedVote): Promise<void>;
  hasVoted(battleId: string, voterId: string): Promise<boolean>;
  tally(battleId: string): Promise<VoteTally>;
  listByBattle(battleId: string): Promise<WeightedVote[]>;
  flagFraud(battleId: string, voterId: string): Promise<void>;
}

export interface TrustScorePort {
  getScore(userId: string): Promise<number>;
}

export interface PatronMultiplierPort {
  getMultiplier(userId: string): Promise<number>;
}

export interface VoteVelocityPort {
  recordVote(voterId: string): Promise<void>;
  getRecentVoteCount(voterId: string, windowMs: number): Promise<number>;
}

export interface FraudDetectorPort {
  check(input: FraudCheckInput): Promise<FraudCheckResult>;
}
