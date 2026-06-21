import type { DomainEvent } from '../event';
export declare const BATTLE_CREATED: "battle.created";
export declare const BATTLE_STARTED: "battle.started";
export declare const BATTLE_VOTING_OPENED: "battle.voting_opened";
export declare const BATTLE_ENDED: "battle.ended";
export declare const BATTLE_VOTE_CAST: "battle.vote_cast";
export declare const BATTLE_SETTLED: "battle.settled";
export declare const BATTLE_ELO_UPDATED: "battle.elo_updated";
export declare const BATTLE_HIGHLIGHT_PUSHED: "battle.highlight_pushed";
export declare const ARENA_SEASON_STARTED: "arena_season.started";
export declare const ARENA_SEASON_ENDED: "arena_season.ended";
export declare const HOUSE_BATTLE_CREATED: "house_battle.created";
export declare const PRIZE_POOL_SETTLED: "prize_pool.settled";
export interface BattleCreatedPayload {
    battleId: string;
    type: string;
    title: string;
    votingMethod: string;
    arenaId?: string;
    arenaSeasonId?: string;
}
export interface BattleStartedPayload {
    battleId: string;
    startedAt: string;
    participantCount: number;
}
export interface BattleVotingOpenedPayload {
    battleId: string;
    votingEndsAt?: string;
}
export interface BattleEndedPayload {
    battleId: string;
    winnerStarId?: string;
    winnerTeamId?: string;
    endedAt: string;
}
export interface BattleVoteCastPayload {
    voteId: string;
    battleId: string;
    voterId: string;
    targetParticipantId: string;
    finalWeight: number;
    fraudFlag: boolean;
}
export interface BattleSettledPayload {
    battleId: string;
    winnerStarId?: string;
    prizePoolId?: string;
    totalCoins: number;
    distribution: string;
}
export interface BattleEloUpdatedPayload {
    starProfileId: string;
    oldElo: number;
    newElo: number;
    delta: number;
    division: string;
    seasonId?: string;
}
export interface BattleHighlightPushedPayload {
    highlightId: string;
    battleId: string;
    title: string;
    isWinnerClip: boolean;
    isViralMoment: boolean;
}
export interface ArenaSeasonStartedPayload {
    seasonId: string;
    name: string;
    number: number;
    startsAt: string;
    endsAt: string;
}
export interface ArenaSeasonEndedPayload {
    seasonId: string;
    number: number;
    endedAt: string;
}
export interface HouseBattleCreatedPayload {
    houseBattleId: string;
    challengerHouseId: string;
    defenderHouseId: string;
    battleId: string;
}
export interface PrizePoolSettledPayload {
    prizePoolId: string;
    battleId: string;
    totalCoins: number;
    distribution: string;
    settledAt: string;
}
export type BattleCreatedEvent = DomainEvent<BattleCreatedPayload>;
export type BattleStartedEvent = DomainEvent<BattleStartedPayload>;
export type BattleVotingOpenedEvent = DomainEvent<BattleVotingOpenedPayload>;
export type BattleEndedEvent = DomainEvent<BattleEndedPayload>;
export type BattleVoteCastEvent = DomainEvent<BattleVoteCastPayload>;
export type BattleSettledEvent = DomainEvent<BattleSettledPayload>;
export type BattleEloUpdatedEvent = DomainEvent<BattleEloUpdatedPayload>;
export type BattleHighlightPushedEvent = DomainEvent<BattleHighlightPushedPayload>;
export type ArenaSeasonStartedEvent = DomainEvent<ArenaSeasonStartedPayload>;
export type ArenaSeasonEndedEvent = DomainEvent<ArenaSeasonEndedPayload>;
export type HouseBattleCreatedEvent = DomainEvent<HouseBattleCreatedPayload>;
export type PrizePoolSettledEvent = DomainEvent<PrizePoolSettledPayload>;
