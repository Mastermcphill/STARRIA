// ---------------------------------------------------------------------------
// arena-core — Battle ports (Sprint 8)
// ---------------------------------------------------------------------------

import type {
  BattleRecord,
  CreateBattleInput,
  BattleParticipantRecord,
  JoinBattleInput,
  BattleTeamRecord,
  CreateTeamInput,
  PrizePoolRecord,
  PrizePoolContributionInput,
  ArenaSeasonRecord,
  CreateArenaSeasonInput,
  CreatorEloRecord,
  BattleHighlightRecord,
  LeaderboardEntry,
  ArenaDivision,
} from './battle-types';

export interface BattleStorePort {
  create(input: CreateBattleInput): Promise<BattleRecord>;
  findById(id: string): Promise<BattleRecord | undefined>;
  findByArena(arenaId: string): Promise<BattleRecord[]>;
  updateStatus(id: string, status: BattleRecord['status']): Promise<BattleRecord>;
  setWinner(id: string, winnerStarId: string): Promise<BattleRecord>;
  markEloAwarded(id: string): Promise<void>;
  list(filter?: { status?: BattleRecord['status']; type?: BattleRecord['type'] }): Promise<BattleRecord[]>;
}

export interface BattleParticipantPort {
  join(input: JoinBattleInput): Promise<BattleParticipantRecord>;
  findByBattle(battleId: string): Promise<BattleParticipantRecord[]>;
  findById(id: string): Promise<BattleParticipantRecord | undefined>;
  incrementScore(id: string, delta: number): Promise<void>;
}

export interface BattleTeamPort {
  create(input: CreateTeamInput): Promise<BattleTeamRecord>;
  findByBattle(battleId: string): Promise<BattleTeamRecord[]>;
}

export interface PrizePoolPort {
  create(battleId: string, distribution: PrizePoolRecord['distribution']): Promise<PrizePoolRecord>;
  contribute(input: PrizePoolContributionInput): Promise<void>;
  findByBattle(battleId: string): Promise<PrizePoolRecord | undefined>;
  settle(prizePoolId: string): Promise<PrizePoolRecord>;
}

export interface ArenaSeasonPort {
  create(input: CreateArenaSeasonInput): Promise<ArenaSeasonRecord>;
  findActive(): Promise<ArenaSeasonRecord | undefined>;
  findById(id: string): Promise<ArenaSeasonRecord | undefined>;
  list(): Promise<ArenaSeasonRecord[]>;
  endSeason(id: string): Promise<void>;
}

export interface CreatorEloPort {
  getOrCreate(starProfileId: string, seasonId?: string): Promise<CreatorEloRecord>;
  update(starProfileId: string, seasonId: string | undefined, delta: { elo: number; win?: boolean; loss?: boolean; draw?: boolean }): Promise<CreatorEloRecord>;
  applyDecay(starProfileId: string, seasonId?: string): Promise<void>;
  getLeaderboard(seasonId?: string, division?: ArenaDivision, limit?: number): Promise<LeaderboardEntry[]>;
}

export interface BattleHighlightPort {
  create(battleId: string, title: string, opts?: { clipUrl?: string; isWinnerClip?: boolean; isViralMoment?: boolean }): Promise<BattleHighlightRecord>;
  findByBattle(battleId: string): Promise<BattleHighlightRecord[]>;
  pushToDiscovery(id: string): Promise<void>;
}
