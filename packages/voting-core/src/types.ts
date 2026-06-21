// ---------------------------------------------------------------------------
// voting-core — types
// ---------------------------------------------------------------------------

export type VotingMethod = 'AUDIENCE' | 'SUPPORTER_WEIGHTED' | 'JUDGE' | 'HYBRID';

export interface CastVoteInput {
  readonly battleId: string;
  readonly voterId: string;
  readonly targetParticipantId: string;
  readonly isJudgeVote?: boolean;
}

export interface VoteWeightContext {
  readonly voterId: string;
  readonly battleId: string;
  readonly voterTrustScore: number;    // 0..1 from trust-core
  readonly patronMultiplier: number;   // 1.0 for non-patrons, >1 for patrons
  readonly isJudge: boolean;
}

export interface WeightedVote {
  readonly voterId: string;
  readonly battleId: string;
  readonly targetParticipantId: string;
  readonly baseWeight: number;
  readonly trustScore: number;
  readonly patronMultiplier: number;
  readonly finalWeight: number;
  readonly isJudgeVote: boolean;
  readonly fraudFlag: boolean;
}

export interface VoteResult {
  readonly accepted: boolean;
  readonly vote?: WeightedVote;
  readonly reason?: string;
}

export interface VoteTally {
  readonly battleId: string;
  readonly participants: Array<{
    participantId: string;
    totalWeight: number;
    voteCount: number;
  }>;
  readonly computedAt: string;
}

export interface FraudCheckInput {
  readonly voterId: string;
  readonly battleId: string;
  readonly targetParticipantId: string;
  readonly voterTrustScore: number;
}

export interface FraudCheckResult {
  readonly flagged: boolean;
  readonly reason?: 'LOW_TRUST' | 'SELF_VOTE' | 'DUPLICATE' | 'VELOCITY_ABUSE' | 'BOT_PATTERN';
}
