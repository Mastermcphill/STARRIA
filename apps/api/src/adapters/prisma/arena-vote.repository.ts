// ---------------------------------------------------------------------------
// Prisma adapter stub — ArenaVote + ArenaVoteResponse repositories
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import type { ArenaVote, ArenaVoteResponse } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface VoteOption {
  id: string;
  text: string;
}

@Injectable()
export class ArenaVoteRepository {
  constructor(private readonly db: PrismaService) {}

  // ── Votes ──────────────────────────────────────────────────────────────────

  async create(data: {
    arenaId: string;
    createdByUserId: string;
    question: string;
    options: VoteOption[];
    endsAt?: Date;
  }): Promise<ArenaVote> {
    return this.db.arenaVote.create({
      data: { ...data, options: data.options as unknown as import('@prisma/client').Prisma.InputJsonValue },
    });
  }

  async findById(id: string): Promise<ArenaVote | null> {
    return this.db.arenaVote.findUnique({ where: { id } });
  }

  async close(id: string): Promise<ArenaVote> {
    return this.db.arenaVote.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
  }

  async listByArena(
    arenaId: string,
    opts?: { status?: ArenaVote['status'] },
  ): Promise<ArenaVote[]> {
    return this.db.arenaVote.findMany({
      where: { arenaId, ...(opts?.status ? { status: opts.status } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Responses ──────────────────────────────────────────────────────────────

  async castVote(data: {
    arenaVoteId: string;
    userId: string;
    optionId: string;
  }): Promise<ArenaVoteResponse> {
    const [response] = await this.db.$transaction([
      this.db.arenaVoteResponse.create({ data }),
      this.db.arenaVote.update({
        where: { id: data.arenaVoteId },
        data: { totalVotes: { increment: 1 } },
      }),
    ]);
    return response as ArenaVoteResponse;
  }

  async findResponse(
    arenaVoteId: string,
    userId: string,
  ): Promise<ArenaVoteResponse | null> {
    return this.db.arenaVoteResponse.findUnique({
      where: { arenaVoteId_userId: { arenaVoteId, userId } },
    });
  }

  async countByOption(
    arenaVoteId: string,
  ): Promise<Array<{ optionId: string; count: number }>> {
    const rows = await this.db.arenaVoteResponse.groupBy({
      by: ['optionId'],
      where: { arenaVoteId },
      _count: { id: true },
    });
    return rows.map(r => ({ optionId: r.optionId, count: r._count.id }));
  }
}
