// ---------------------------------------------------------------------------
// arena-core — BattleService (Sprint 8)
// Orchestrates the full battle lifecycle: create → register → start → vote → settle.
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type { EventBus } from '@starria/domain-events';
import type {
  BattleRecord,
  CreateBattleInput,
  JoinBattleInput,
  BattleParticipantRecord,
  PrizePoolRecord,
  CreatorEloRecord,
} from './battle-types';
import type {
  BattleStorePort,
  BattleParticipantPort,
  BattleTeamPort,
  PrizePoolPort,
  CreatorEloPort,
  BattleHighlightPort,
  ArenaSeasonPort,
} from './battle-ports';
import {
  buildBattleCreatedEvent,
  buildBattleStartedEvent,
  buildBattleEndedEvent,
  buildBattleSettledEvent,
  buildEloUpdatedEvent,
  buildHighlightPushedEvent,
} from './battle-events';

// ELO K-factor by division
const K_FACTORS: Record<string, number> = {
  BRONZE: 32, SILVER: 28, GOLD: 24, PLATINUM: 20, DIAMOND: 16, LEGEND: 12,
};

function divisionForElo(elo: number): string {
  if (elo >= 2400) return 'LEGEND';
  if (elo >= 2000) return 'DIAMOND';
  if (elo >= 1600) return 'PLATINUM';
  if (elo >= 1300) return 'GOLD';
  if (elo >= 1100) return 'SILVER';
  return 'BRONZE';
}

function expectedScore(a: number, b: number): number {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

export class BattleService {
  constructor(
    private readonly battles: BattleStorePort,
    private readonly participants: BattleParticipantPort,
    private readonly teams: BattleTeamPort,
    private readonly prizePool: PrizePoolPort,
    private readonly elo: CreatorEloPort,
    private readonly highlights: BattleHighlightPort,
    private readonly seasons: ArenaSeasonPort,
    private readonly eventBus?: EventBus,
  ) {}

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async createBattle(input: CreateBattleInput): Promise<BattleRecord> {
    const battle = await this.battles.create(input);
    await this.eventBus?.publish(buildBattleCreatedEvent({
      battleId: battle.id,
      type: battle.type,
      title: battle.title,
      arenaId: battle.arenaId,
    }));
    return battle;
  }

  async joinBattle(input: JoinBattleInput): Promise<BattleParticipantRecord> {
    const battle = await this.battles.findById(input.battleId);
    if (!battle) throw new Error(`Battle ${input.battleId} not found`);
    if (battle.status !== 'REGISTRATION' && battle.status !== 'DRAFT') {
      throw new Error(`Battle is not accepting registrations (status: ${battle.status})`);
    }
    return this.participants.join(input);
  }

  async startBattle(battleId: string): Promise<BattleRecord> {
    const battle = await this.battles.updateStatus(battleId, 'ACTIVE');
    await this.eventBus?.publish(buildBattleStartedEvent({
      battleId,
      startedAt: new Date().toISOString(),
    }));
    return battle;
  }

  async moveTovoting(battleId: string): Promise<BattleRecord> {
    return this.battles.updateStatus(battleId, 'VOTING');
  }

  async endBattle(battleId: string, winnerStarId?: string): Promise<BattleRecord> {
    const settled = await this.battles.setWinner(battleId, winnerStarId ?? '');
    await this.eventBus?.publish(buildBattleEndedEvent({
      battleId,
      winnerStarId,
      endedAt: new Date().toISOString(),
    }));
    return settled;
  }

  // ── ELO settlement ────────────────────────────────────────────────────────

  async settleElo(battleId: string): Promise<void> {
    const battle = await this.battles.findById(battleId);
    if (!battle || battle.eloAwarded) return;

    const ps = await this.participants.findByBattle(battleId);
    if (ps.length < 2) return;

    const season = await this.seasons.findActive();
    const [p1, p2] = ps;
    const [e1, e2] = await Promise.all([
      this.elo.getOrCreate(p1.starProfileId, season?.id),
      this.elo.getOrCreate(p2.starProfileId, season?.id),
    ]);

    const winner = battle.winnerStarId;
    const s1 = winner === p1.starProfileId ? 1 : winner === p2.starProfileId ? 0 : 0.5;
    const s2 = 1 - s1;

    const k1 = K_FACTORS[e1.division] ?? 32;
    const k2 = K_FACTORS[e2.division] ?? 32;

    const newElo1 = Math.round(e1.elo + k1 * (s1 - expectedScore(e1.elo, e2.elo)));
    const newElo2 = Math.round(e2.elo + k2 * (s2 - expectedScore(e2.elo, e1.elo)));

    await Promise.all([
      this.elo.update(p1.starProfileId, season?.id, { elo: newElo1, win: s1 === 1, loss: s1 === 0, draw: s1 === 0.5 }),
      this.elo.update(p2.starProfileId, season?.id, { elo: newElo2, win: s2 === 1, loss: s2 === 0, draw: s2 === 0.5 }),
    ]);

    await this.battles.markEloAwarded(battleId);

    await Promise.all([
      this.eventBus?.publish(buildEloUpdatedEvent({ starProfileId: p1.starProfileId, oldElo: e1.elo, newElo: newElo1, division: divisionForElo(newElo1), seasonId: season?.id })),
      this.eventBus?.publish(buildEloUpdatedEvent({ starProfileId: p2.starProfileId, oldElo: e2.elo, newElo: newElo2, division: divisionForElo(newElo2), seasonId: season?.id })),
    ]);
  }

  // ── Prize settlement ──────────────────────────────────────────────────────

  async settlePrize(battleId: string): Promise<PrizePoolRecord> {
    const pool = await this.prizePool.findByBattle(battleId);
    if (!pool) throw new Error(`No prize pool for battle ${battleId}`);
    const settled = await this.prizePool.settle(pool.id);
    await this.eventBus?.publish(buildBattleSettledEvent({
      battleId,
      prizePoolId: pool.id,
      distribution: pool.distribution,
      totalCoins: pool.totalCoins,
    }));
    return settled;
  }

  // ── Highlights ────────────────────────────────────────────────────────────

  async generateHighlight(battleId: string, title: string, opts?: { isWinnerClip?: boolean; isViralMoment?: boolean }): Promise<void> {
    const h = await this.highlights.create(battleId, title, opts);
    await this.highlights.pushToDiscovery(h.id);
    await this.eventBus?.publish(buildHighlightPushedEvent({ highlightId: h.id, battleId, title }));
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  async getLeaderboard(seasonId?: string, limit = 50) {
    return this.elo.getLeaderboard(seasonId, undefined, limit);
  }

  async getBattle(battleId: string): Promise<BattleRecord | undefined> {
    return this.battles.findById(battleId);
  }

  async listBattles(filter?: { status?: BattleRecord['status']; type?: BattleRecord['type'] }) {
    return this.battles.list(filter);
  }
}
