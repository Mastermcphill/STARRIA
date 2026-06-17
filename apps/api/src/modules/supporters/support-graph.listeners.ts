// ---------------------------------------------------------------------------
// SupportGraphListeners — subscribes to domain events and updates the graph.
//
// CoinGiftSentEvent → handleGift → upsert SupportRelationship → milestones
// ---------------------------------------------------------------------------

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { EventBus } from '@starria/domain-events';
import { GIFT_COIN_SENT } from '@starria/domain-events';
import type { CoinGiftSentEvent } from '@starria/domain-events';
import { EVENT_BUS } from '../../event-bus/event-bus.module';
import { SupportGraphService } from './support-graph.service';
import { SupportersService } from './supporters.service';

@Injectable()
export class SupportGraphListeners implements OnModuleInit {
  private readonly logger = new Logger(SupportGraphListeners.name);

  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
    private readonly supportGraph: SupportGraphService,
    private readonly supporters: SupportersService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe<CoinGiftSentEvent>(GIFT_COIN_SENT, async (event) => {
      try {
        const { senderId, recipientId, coins } = event.payload;

        // Update lifetime spend on the SupporterProfile
        const profile = await this.supporters.getByUserId(senderId);
        if (profile) {
          await this.supporters.recordSpend(profile.id, coins, 0);
        }

        // Upsert SupportRelationship and evaluate milestones
        await this.supportGraph.handleGift({
          senderUserId: senderId,
          recipientUserId: recipientId,
          coinsGifted: coins,
        });
      } catch (err) {
        this.logger.error('SupportGraphListeners.CoinGiftSentEvent failed', err);
      }
    });

    this.logger.log('SupportGraph event listeners registered');
  }
}
