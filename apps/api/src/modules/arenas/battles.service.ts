import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { computeEloUpdate, divisionForElo, seasonalReset } from '@starria/ranking-core';

@Injectable()
export class BattlesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Battles ──────────────────────────────────────────────────────────────

  async createBattle(dto: {
    title: string; type: string; votingMethod?: string; arenaId?: string;
    arenaSeasonId?: string; description?: string; isTeamBattle?: boolean;
    maxParticipants?: number; scheduledAt?: string; prizeDistribution?: string;
  }) {
    const battle = await this.prisma.battle.create({
      data: {
        title: dto.title,
        type: dto.type as any,
        votingMethod: (dto.votingMethod ?? 'HYBRID') as any,
        arenaId: dto.arenaId,
        arenaSeasonId: dto.arenaSeasonId,
        description: dto.description,
        isTeamBattle: dto.isTeamBattle ?? false,
        maxParticipants: dto.maxParticipants ?? 2,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        status: 'DRAFT',
      },
    });

    if (dto.prizeDistribution) {
      await this.prisma.arenaPrizePool.create({
        data: { battleId: battle.id, distribution: dto.prizeDistribution as any },
      });
    }

    return battle;
  }

  async getBattle(id: string) {
    const b = await this.prisma.battle.findUnique({
      where: { id },
      include: { participants: true, teams: true, prizePool: true, highlights: true },
    });
    if (!b) throw new NotFoundException(`Battle ${id} not found`);
    return b;
  }

  async listBattles(status?: string, type?: string) {
    return this.prisma.battle.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(type ? { type: type as any } : {}),
      },
      include: { participants: { select: { starProfileId: true, role: true, voteCount: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async joinBattle(battleId: string, dto: { starProfileId: string; role?: string; teamId?: string }) {
    const battle = await this.prisma.battle.findUnique({ where: { id: battleId } });
    if (!battle) throw new NotFoundException(`Battle ${battleId} not found`);
    if (!['DRAFT', 'REGISTRATION'].includes(battle.status)) {
      throw new BadRequestException(`Battle is not accepting registrations`);
    }
    return this.prisma.battleParticipant.create({
      data: {
        battleId,
        starProfileId: dto.starProfileId,
        role: (dto.role ?? 'CHALLENGER') as any,
        teamId: dto.teamId,
      },
    });
  }

  async startBattle(id: string) {
    return this.prisma.battle.update({
      where: { id },
      data: { status: 'ACTIVE', startedAt: new Date() },
    });
  }

  async endBattle(id: string) {
    await this.prisma.battle.update({
      where: { id },
      data: { status: 'VOTING', endedAt: new Date() },
    });
    return this.prisma.battle.findUnique({ where: { id } });
  }

  async settleBattle(battleId: string) {
    const votes = await this.prisma.battleVote.findMany({
      where: { battleId, fraudFlag: false },
    });

    // Tally weighted votes
    const tally = new Map<string, number>();
    for (const v of votes) {
      tally.set(v.targetParticipantId, (tally.get(v.targetParticipantId) ?? 0) + v.finalWeight);
    }

    let winnerId: string | undefined;
    let best = -Infinity;
    for (const [pid, weight] of tally.entries()) {
      if (weight > best) { best = weight; winnerId = pid; }
    }

    let winnerStarId: string | undefined;
    if (winnerId) {
      const p = await this.prisma.battleParticipant.findUnique({ where: { id: winnerId } });
      winnerStarId = p?.starProfileId;
    }

    const battle = await this.prisma.battle.update({
      where: { id: battleId },
      data: { status: 'SETTLED', winnerStarId },
    });

    // Update ELO
    await this._applyElo(battleId, winnerStarId);

    // Settle prize pool
    await this.prisma.arenaPrizePool.updateMany({
      where: { battleId, settled: false },
      data: { settled: true, settledAt: new Date() },
    });

    return battle;
  }

  private async _applyElo(battleId: string, winnerStarId?: string) {
    const participants = await this.prisma.battleParticipant.findMany({ where: { battleId } });
    if (participants.length < 2) return;

    const [p1, p2] = participants;
    const season = await this.prisma.arenaSeason.findFirst({ where: { status: 'ACTIVE' } });

    const [e1, e2] = await Promise.all([
      this._getOrCreateElo(p1.starProfileId, season?.id),
      this._getOrCreateElo(p2.starProfileId, season?.id),
    ]);

    const isDraw = !winnerStarId;
    const winnerIsP1 = winnerStarId === p1.starProfileId;

    const result = computeEloUpdate({
      winnerElo: winnerIsP1 ? e1.elo : e2.elo,
      loserElo: winnerIsP1 ? e2.elo : e1.elo,
      winnerDivision: (winnerIsP1 ? e1.division : e2.division) as any,
      loserDivision: (winnerIsP1 ? e2.division : e1.division) as any,
      isDraw,
    });

    await Promise.all([
      this.prisma.creatorElo.update({
        where: { id: e1.id },
        data: {
          elo: winnerIsP1 ? result.winnerNewElo : result.loserNewElo,
          division: (winnerIsP1 ? result.winnerNewDivision : result.loserNewDivision) as any,
          wins: { increment: (!isDraw && winnerIsP1) ? 1 : 0 },
          losses: { increment: (!isDraw && !winnerIsP1) ? 1 : 0 },
          draws: { increment: isDraw ? 1 : 0 },
          peakElo: Math.max(e1.peakElo, winnerIsP1 ? result.winnerNewElo : result.loserNewElo),
        },
      }),
      this.prisma.creatorElo.update({
        where: { id: e2.id },
        data: {
          elo: winnerIsP1 ? result.loserNewElo : result.winnerNewElo,
          division: (winnerIsP1 ? result.loserNewDivision : result.winnerNewDivision) as any,
          wins: { increment: (!isDraw && !winnerIsP1) ? 1 : 0 },
          losses: { increment: (!isDraw && winnerIsP1) ? 1 : 0 },
          draws: { increment: isDraw ? 1 : 0 },
          peakElo: Math.max(e2.peakElo, winnerIsP1 ? result.loserNewElo : result.winnerNewElo),
        },
      }),
      this.prisma.battle.update({ where: { id: battleId }, data: { eloAwarded: true } }),
    ]);
  }

  private async _getOrCreateElo(starProfileId: string, seasonId?: string) {
    const existing = await this.prisma.creatorElo.findFirst({
      where: { starProfileId, arenaSeasonId: seasonId ?? null },
    });
    if (existing) return existing;
    return this.prisma.creatorElo.create({
      data: { starProfileId, arenaSeasonId: seasonId },
    });
  }

  // ── Voting ────────────────────────────────────────────────────────────────

  async castVote(battleId: string, dto: { voterId: string; targetParticipantId: string; isJudgeVote?: boolean }) {
    const [battle, participant, existingVote] = await Promise.all([
      this.prisma.battle.findUnique({ where: { id: battleId } }),
      this.prisma.battleParticipant.findUnique({
        where: { id: dto.targetParticipantId },
        // Pull the owning user so we can detect self-votes by userId, not by
        // comparing a userId against a starProfileId (the previous broken guard).
        include: { starProfile: { select: { userId: true } } },
      }),
      this.prisma.battleVote.findUnique({ where: { battleId_voterId: { battleId, voterId: dto.voterId } } }),
    ]);

    if (!battle) throw new NotFoundException(`Battle ${battleId} not found`);
    if (!participant) throw new NotFoundException(`Participant ${dto.targetParticipantId} not found`);
    if (battle.status !== 'VOTING') throw new BadRequestException('Voting is not open for this battle');
    if (existingVote) throw new BadRequestException('You have already voted in this battle');
    if (participant.starProfile?.userId === dto.voterId) {
      throw new BadRequestException('Cannot vote for yourself');
    }

    // Simplified trust score and patron multiplier — production pulls from trust/patron services
    const trustScore = 1.0;
    const patronMultiplier = 1.0;
    const baseWeight = dto.isJudgeVote ? 3.0 : 1.0;
    const finalWeight = baseWeight * trustScore * patronMultiplier;

    const vote = await this.prisma.battleVote.create({
      data: {
        battleId,
        voterId: dto.voterId,
        targetParticipantId: dto.targetParticipantId,
        baseWeight,
        trustScore,
        patronMultiplier,
        finalWeight,
        isJudgeVote: dto.isJudgeVote ?? false,
      },
    });

    await this.prisma.battleParticipant.update({
      where: { id: dto.targetParticipantId },
      data: { voteCount: { increment: 1 } },
    });

    return vote;
  }

  // ── Prize Pool ────────────────────────────────────────────────────────────

  async contributeToPrizePool(battleId: string, dto: { contributorId: string; source: string; coins: number }) {
    const pool = await this.prisma.arenaPrizePool.findUnique({ where: { battleId } });
    if (!pool) throw new NotFoundException(`No prize pool for battle ${battleId}`);

    await Promise.all([
      this.prisma.prizePoolContribution.create({
        data: { prizePoolId: pool.id, contributorId: dto.contributorId, source: dto.source as any, coins: dto.coins },
      }),
      this.prisma.arenaPrizePool.update({
        where: { id: pool.id },
        data: { totalCoins: { increment: dto.coins } },
      }),
    ]);

    return this.prisma.arenaPrizePool.findUnique({ where: { id: pool.id } });
  }

  // ── Leaderboard ───────────────────────────────────────────────────────────

  async getLeaderboard(seasonId?: string, division?: string, limit = 50) {
    return this.prisma.creatorElo.findMany({
      where: {
        ...(seasonId ? { arenaSeasonId: seasonId } : { arenaSeasonId: null }),
        ...(division ? { division: division as any } : {}),
      },
      include: { starProfile: { select: { id: true, userId: true } } },
      orderBy: [{ elo: 'desc' }, { wins: 'desc' }],
      take: limit,
    });
  }

  // ── Seasons ───────────────────────────────────────────────────────────────

  async createSeason(dto: { name: string; number: number; startsAt: string; endsAt: string }) {
    return this.prisma.arenaSeason.create({
      data: {
        name: dto.name,
        number: dto.number,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        status: 'UPCOMING',
      },
    });
  }

  async getActiveSeason() {
    return this.prisma.arenaSeason.findFirst({ where: { status: 'ACTIVE' } });
  }

  async resetSeason(seasonId: string) {
    const eloRecords = await this.prisma.creatorElo.findMany({ where: { arenaSeasonId: seasonId } });
    await Promise.all(
      eloRecords.map(r =>
        this.prisma.creatorElo.update({
          where: { id: r.id },
          data: { elo: seasonalReset(r.elo), division: divisionForElo(seasonalReset(r.elo)) as any },
        }),
      ),
    );
    return this.prisma.arenaSeason.update({ where: { id: seasonId }, data: { status: 'ENDED' } });
  }

  // ── Houses ────────────────────────────────────────────────────────────────

  async getHouse(id: string) {
    const h = await this.prisma.creatorHouse.findUnique({
      where: { id },
      include: { members: { include: { starProfile: { select: { id: true, userId: true } } } } },
    });
    if (!h) throw new NotFoundException(`House ${id} not found`);
    return h;
  }

  async listHouses() {
    return this.prisma.creatorHouse.findMany({
      where: { status: 'ACTIVE' },
      include: { _count: { select: { members: true } } },
      orderBy: { memberCount: 'desc' },
    });
  }
}
