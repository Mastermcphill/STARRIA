import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CoinGiftingService } from '@starria/gifting-core';
import { createCommissionConfig } from '@starria/gifting-core';
import type { EventBus } from '@starria/domain-events';
import { EVENT_BUS } from '../../event-bus/event-bus.module';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaCoinLedgerRepository } from '../wallet/prisma-coin-ledger.repository';
import { getPlatformFeePct } from './platform-fee';
import { getGiftItem, GIFT_CATALOG } from './gift-catalog';
import type { SendCoinGiftDto } from './dto/send-coin-gift.dto';
import type { GiftHistoryQueryDto } from './dto/gift-history.dto';

@Injectable()
export class GiftingService {
  constructor(
    private readonly db: PrismaService,
    private readonly ledger: PrismaCoinLedgerRepository,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  getCatalog() {
    return GIFT_CATALOG;
  }

  async sendCoinGift(senderUserId: string, dto: SendCoinGiftDto) {
    // Resolve coin amount from catalog item or raw amount
    let coins: number;
    if (dto.giftId) {
      const item = getGiftItem(dto.giftId);
      if (!item) throw new NotFoundException(`Gift type '${dto.giftId}' not found in catalog`);
      coins = item.coins;
    } else if (dto.coins) {
      coins = dto.coins;
    } else {
      throw new NotFoundException('Provide either giftId or coins');
    }

    // Look up recipient star tier for fee calculation
    const [senderUser, recipientUser] = await Promise.all([
      this.db.user.findUnique({ where: { id: senderUserId }, select: { id: true } }),
      this.db.user.findUnique({
        where: { id: dto.recipientId },
        select: { id: true, starProfile: { select: { tier: true } } },
      }),
    ]);

    if (!senderUser) throw new NotFoundException('Sender not found');
    if (!recipientUser) throw new NotFoundException('Recipient not found');

    const starTier = recipientUser.starProfile?.tier ?? null;
    const hasGoldStar = !!(await this.db.goldStarProfile.findUnique({
      where: { starProfileId: recipientUser.starProfile ? (await this.db.starProfile.findUnique({ where: { userId: dto.recipientId }, select: { id: true } }))?.id ?? '' : '' },
      select: { id: true, status: true },
    }).then(g => g?.status === 'ACTIVE').catch(() => false));

    const platformPct = getPlatformFeePct(starTier, hasGoldStar);
    const commission = createCommissionConfig(platformPct);

    const service = new CoinGiftingService(this.ledger, commission, undefined, this.eventBus);

    return service.sendCoinGift({
      senderId: senderUserId,
      recipientId: dto.recipientId,
      coins,
      targetType: dto.targetType,
      contentId: dto.contentId,
      idempotencyKey: dto.idempotencyKey ?? `coin_gift:${randomUUID()}`,
      note: dto.note,
    });
  }

  async getGiftHistory(query: GiftHistoryQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.senderId) where['senderId'] = query.senderId;
    if (query.recipientId) where['receiverId'] = query.recipientId;

    const [items, total] = await Promise.all([
      this.db.tap.findMany({
        where: { ...where, type: 'COIN_GIFT' },
        take: query.limit,
        skip: query.offset,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.tap.count({ where: { ...where, type: 'COIN_GIFT' } }),
    ]);
    return { items, total };
  }
}
