// ---------------------------------------------------------------------------
// arena-core — battle domain events (Sprint 8)
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import { createEvent } from '@starria/domain-events';

export const BATTLE_CREATED   = 'battle.created'   as const;
export const BATTLE_STARTED   = 'battle.started'   as const;
export const BATTLE_ENDED     = 'battle.ended'     as const;
export const BATTLE_VOTE_CAST = 'battle.vote_cast' as const;
export const BATTLE_SETTLED   = 'battle.settled'   as const;
export const ELO_UPDATED      = 'battle.elo_updated' as const;
export const HIGHLIGHT_PUSHED = 'battle.highlight_pushed' as const;

export function buildBattleCreatedEvent(p: { battleId: string; type: string; title: string; arenaId?: string }) {
  return createEvent({ id: randomUUID(), type: BATTLE_CREATED, aggregateId: p.battleId, aggregateType: 'Battle', payload: p });
}

export function buildBattleStartedEvent(p: { battleId: string; startedAt: string }) {
  return createEvent({ id: randomUUID(), type: BATTLE_STARTED, aggregateId: p.battleId, aggregateType: 'Battle', payload: p });
}

export function buildBattleEndedEvent(p: { battleId: string; winnerStarId?: string; winnerTeamId?: string; endedAt: string }) {
  return createEvent({ id: randomUUID(), type: BATTLE_ENDED, aggregateId: p.battleId, aggregateType: 'Battle', payload: p });
}

export function buildBattleVoteCastEvent(p: { voteId: string; battleId: string; voterId: string; targetParticipantId: string; finalWeight: number }) {
  return createEvent({ id: randomUUID(), type: BATTLE_VOTE_CAST, aggregateId: p.battleId, aggregateType: 'Battle', payload: p });
}

export function buildBattleSettledEvent(p: { battleId: string; prizePoolId: string; distribution: string; totalCoins: number }) {
  return createEvent({ id: randomUUID(), type: BATTLE_SETTLED, aggregateId: p.battleId, aggregateType: 'Battle', payload: p });
}

export function buildEloUpdatedEvent(p: { starProfileId: string; oldElo: number; newElo: number; division: string; seasonId?: string }) {
  return createEvent({ id: randomUUID(), type: ELO_UPDATED, aggregateId: p.starProfileId, aggregateType: 'CreatorElo', payload: p });
}

export function buildHighlightPushedEvent(p: { highlightId: string; battleId: string; title: string }) {
  return createEvent({ id: randomUUID(), type: HIGHLIGHT_PUSHED, aggregateId: p.highlightId, aggregateType: 'BattleHighlight', payload: p });
}
