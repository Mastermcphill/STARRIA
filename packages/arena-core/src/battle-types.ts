// ---------------------------------------------------------------------------
// arena-core — Battle types (Sprint 8)
// Extends arena-core with competitive battle domain objects.
// ---------------------------------------------------------------------------

export type BattleType =
  | 'RAP_BATTLE'
  | 'SING_OFF'
  | 'COMEDY_CLASH'
  | 'YAP_BATTLE'
  | 'AI_FILM_BATTLE'
  | 'CREATOR_DUEL'
  | 'TEAM_BATTLE';

export type BattleStatus =
  | 'DRAFT'
  | 'REGISTRATION'
  | 'ACTIVE'
  | 'VOTING'
  | 'SETTLED'
  | 'ARCHIVED';

export type VotingMethod = 'AUDIENCE' | 'SUPPORTER_WEIGHTED' | 'JUDGE' | 'HYBRID';

export type BattleParticipantRole = 'CHALLENGER' | 'DEFENDER' | 'TEAM_MEMBER' | 'JUDGE';

export type PrizeDistribution = 'WINNER_TAKES_ALL' | 'TOP_3_PAYOUT' | 'SPLIT_PAYOUT';

export type PrizePoolSource = 'TICKETS' | 'SPONSORSHIP' | 'CREATOR_DEPOSIT' | 'FAN_CONTRIBUTION';

export type ArenaDivision = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'LEGEND';

export type ArenaSeasonStatus = 'UPCOMING' | 'ACTIVE' | 'ENDED';

// ── Battle ─────────────────────────────────────────────────────────────────

export interface BattleRecord {
  readonly id: string;
  readonly arenaId?: string;
  readonly arenaSeasonId?: string;
  readonly type: BattleType;
  readonly status: BattleStatus;
  readonly votingMethod: VotingMethod;
  readonly title: string;
  readonly description?: string;
  readonly isTeamBattle: boolean;
  readonly maxParticipants: number;
  readonly registrationEndsAt?: string;
  readonly votingEndsAt?: string;
  readonly scheduledAt?: string;
  readonly startedAt?: string;
  readonly endedAt?: string;
  readonly winnerStarId?: string;
  readonly winnerTeamId?: string;
  readonly eloAwarded: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateBattleInput {
  readonly arenaId?: string;
  readonly arenaSeasonId?: string;
  readonly type: BattleType;
  readonly title: string;
  readonly description?: string;
  readonly votingMethod?: VotingMethod;
  readonly isTeamBattle?: boolean;
  readonly maxParticipants?: number;
  readonly scheduledAt?: string;
}

export interface JoinBattleInput {
  readonly battleId: string;
  readonly starProfileId: string;
  readonly role?: BattleParticipantRole;
  readonly teamId?: string;
}

// ── Participants ──────────────────────────────────────────────────────────

export interface BattleParticipantRecord {
  readonly id: string;
  readonly battleId: string;
  readonly starProfileId: string;
  readonly role: BattleParticipantRole;
  readonly teamId?: string;
  readonly score: number;
  readonly voteCount: number;
  readonly joinedAt: string;
}

// ── Team ─────────────────────────────────────────────────────────────────

export interface BattleTeamRecord {
  readonly id: string;
  readonly battleId: string;
  readonly name: string;
  readonly side: string;
  readonly score: number;
}

export interface CreateTeamInput {
  readonly battleId: string;
  readonly name: string;
  readonly side: 'A' | 'B';
}

// ── Prize Pool ────────────────────────────────────────────────────────────

export interface PrizePoolRecord {
  readonly id: string;
  readonly battleId?: string;
  readonly totalCoins: number;
  readonly distribution: PrizeDistribution;
  readonly escrowed: boolean;
  readonly settled: boolean;
  readonly settledAt?: string;
}

export interface PrizePoolContributionInput {
  readonly prizePoolId: string;
  readonly contributorId: string;
  readonly source: PrizePoolSource;
  readonly coins: number;
}

// ── Season ────────────────────────────────────────────────────────────────

export interface ArenaSeasonRecord {
  readonly id: string;
  readonly name: string;
  readonly number: number;
  readonly status: ArenaSeasonStatus;
  readonly startsAt: string;
  readonly endsAt: string;
}

export interface CreateArenaSeasonInput {
  readonly name: string;
  readonly number: number;
  readonly startsAt: string;
  readonly endsAt: string;
}

// ── ELO ──────────────────────────────────────────────────────────────────

export interface CreatorEloRecord {
  readonly id: string;
  readonly starProfileId: string;
  readonly arenaSeasonId?: string;
  readonly elo: number;
  readonly division: ArenaDivision;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly peakElo: number;
  readonly decayAppliedAt?: string;
}

// ── Highlights ────────────────────────────────────────────────────────────

export interface BattleHighlightRecord {
  readonly id: string;
  readonly battleId: string;
  readonly title: string;
  readonly clipUrl?: string;
  readonly isWinnerClip: boolean;
  readonly isViralMoment: boolean;
  readonly pushedToDiscovery: boolean;
  readonly createdAt: string;
}

// ── Leaderboard ──────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  readonly rank: number;
  readonly starProfileId: string;
  readonly displayName: string;
  readonly elo: number;
  readonly division: ArenaDivision;
  readonly wins: number;
  readonly losses: number;
}
