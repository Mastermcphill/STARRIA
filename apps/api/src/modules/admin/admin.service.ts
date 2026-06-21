import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NestModerationService } from '../moderation/moderation.service';
import { TokenRevocationService } from '../auth/token-revocation.service';
import type { ModerationQueueFilter } from '@starria/moderation-core';

const USER_PUBLIC = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  role: true,
  isSuspended: true,
  suspendedAt: true,
  suspensionReason: true,
  createdAt: true,
} as const;

/**
 * Admin operations service. Every method here is reachable only through
 * AdminController, which is gated @Roles(ADMIN). Privileged mutations
 * (suspend/unsuspend) write a ModerationAuditLog row for traceability.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly db: PrismaService,
    private readonly moderation: NestModerationService,
    private readonly revocation: TokenRevocationService,
  ) {}

  // ─── Users ──────────────────────────────────────────────────────────────────

  async lookupUser(query: string) {
    const q = query?.trim();
    if (!q) throw new BadRequestException('query is required');
    const user = await this.db.user.findFirst({
      where: { OR: [{ id: q }, { email: q }, { username: q }] },
      select: USER_PUBLIC,
    });
    if (!user) throw new NotFoundException(`No user matching '${q}'`);
    return user;
  }

  async suspendUser(actorId: string, userId: string, reason?: string) {
    await this.requireUser(userId);
    const user = await this.db.user.update({
      where: { id: userId },
      data: { isSuspended: true, suspendedAt: new Date(), suspensionReason: reason ?? null },
      select: USER_PUBLIC,
    });
    // Suspension must invalidate every token the user currently holds, not just
    // block future logins — otherwise an active session survives the ban.
    await this.revocation.revokeAllForUser(userId);
    await this.audit(actorId, 'suspend', userId, reason);
    return user;
  }

  async unsuspendUser(actorId: string, userId: string) {
    await this.requireUser(userId);
    const user = await this.db.user.update({
      where: { id: userId },
      data: { isSuspended: false, suspendedAt: null, suspensionReason: null },
      select: USER_PUBLIC,
    });
    await this.audit(actorId, 'unsuspend', userId);
    return user;
  }

  // ─── Battle audit ─────────────────────────────────────────────────────────

  async auditBattles(status?: string, limit = 50, offset = 0) {
    const [items, total] = await Promise.all([
      this.db.battle.findMany({
        where: status ? { status: status as never } : {},
        include: {
          participants: { select: { starProfileId: true, role: true, voteCount: true } },
          prizePool: true,
          _count: { select: { votes: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.db.battle.count({ where: status ? { status: status as never } : {} }),
    ]);
    return { items, total };
  }

  async auditBattle(id: string) {
    const battle = await this.db.battle.findUnique({
      where: { id },
      include: { participants: true, teams: true, prizePool: true, votes: true, highlights: true },
    });
    if (!battle) throw new NotFoundException(`Battle ${id} not found`);
    return battle;
  }

  // ─── Transaction audit ────────────────────────────────────────────────────

  async auditTransactions(userId?: string, limit = 50, offset = 0) {
    let walletId: string | undefined;
    if (userId) {
      const wallet = await this.db.wallet.findUnique({ where: { userId }, select: { id: true } });
      if (!wallet) throw new NotFoundException(`Wallet not found for user ${userId}`);
      walletId = wallet.id;
    }
    const where = walletId ? { walletId } : {};
    const [items, total] = await Promise.all([
      this.db.walletEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.db.walletEntry.count({ where }),
    ]);
    return { items, total };
  }

  // ─── Replay audit ─────────────────────────────────────────────────────────

  async auditReplays(status?: string, limit = 50, offset = 0) {
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.db.replay.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.db.replay.count({ where }),
    ]);
    return { items, total };
  }

  // ─── Moderation queue (delegates to moderation module) ──────────────────────

  async moderationQueue(filter?: ModerationQueueFilter) {
    return this.moderation.listReports(filter);
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private async requireUser(userId: string): Promise<void> {
    const exists = await this.db.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) throw new NotFoundException(`User ${userId} not found`);
  }

  private async audit(actorId: string, action: string, targetId: string, reason?: string): Promise<void> {
    await this.db.moderationAuditLog.create({
      data: { actorId, action, targetType: 'user', targetId, reason },
    });
  }
}
