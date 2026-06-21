import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { EventBusModule } from './event-bus/event-bus.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { RolesGuard } from './modules/auth/roles.guard';
import { HealthModule } from './modules/health/health.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { AdminModule } from './modules/admin/admin.module';
import { PayoutModule } from './modules/payout/payout.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { StarsModule } from './modules/stars/stars.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { CoinPurchaseModule } from './modules/coin-purchase/coin-purchase.module';
import { GiftingModule } from './modules/gifting/gifting.module';
import { SupportersModule } from './modules/supporters/supporters.module';
import { TapsModule } from './modules/taps/taps.module';
import { EventsModule } from './modules/events/events.module';
import { ArenasModule } from './modules/arenas/arenas.module';
import { AiCreatorModule } from './modules/ai-creator/ai-creator.module';
import { VideoModule } from './modules/video/video.module';
import { WatchModule } from './modules/watch/watch.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { ContentTapModule } from './modules/content-tap/content-tap.module';
import { SearchModule } from './modules/search/search.module';
// Sprint 3 — Live Experience & Ticketing Economy
import { LiveModule } from './modules/live/live.module';
import { TicketingModule } from './modules/ticketing/ticketing.module';
import { PosterModule } from './modules/poster/poster.module';
// Sprint 4 — Prestige & Visibility Marketplace
import { PrestigeModule } from './modules/prestige/prestige.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
// Sprint 5 — Patron Economy, Messaging Prestige & Presence
import { PatronsModule } from './modules/patrons/patrons.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { TrustModule } from './modules/trust/trust.module';
import { PresenceModule } from './modules/presence/presence.module';
// Sprint 6 — Companion Economy
import { CompanionModule } from './modules/companion/companion.module';
// Sprint 7 — LiveKit Stabilization, Creator OS & Session Engine
import { SessionEngineModule } from './modules/session-engine/session-engine.module';
import { ReplayModule } from './modules/replay/replay.module';
import { CreatorOsModule } from './modules/creator-os/creator-os.module';
// Sprint 11
import { LedgerModule } from './modules/wallet/ledger.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
// Storage
import { MediaModule } from './modules/media/media.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    RedisModule,
    EventBusModule,   // global — provides EVENT_BUS token
    HealthModule,     // /health + /health/ready probes
    AuthModule,
    UsersModule,
    StarsModule,
    WalletModule,
    CoinPurchaseModule,
    GiftingModule,
    SupportersModule,
    TapsModule,
    EventsModule,
    ArenasModule,
    AiCreatorModule,
    // Sprint 2 — Video Discovery Engine
    VideoModule,
    WatchModule,
    DiscoveryModule,
    ContentTapModule,
    SearchModule,
    // Sprint 3
    LiveModule,
    TicketingModule,
    PosterModule,
    // Sprint 4
    PrestigeModule,
    CampaignsModule,
    // Sprint 5
    PatronsModule,
    MessagingModule,
    TrustModule,
    PresenceModule,
    // Sprint 6
    CompanionModule,
    // Sprint 7
    SessionEngineModule,
    ReplayModule,
    CreatorOsModule,
    // Sprint 11 — double-entry ledger + analytics pipeline
    LedgerModule,
    AnalyticsModule,
    // Object storage
    MediaModule,
    // Trust & safety + operations
    ModerationModule,
    AdminModule,
    // Payments — multi-provider registry + on/off toggles (global)
    PaymentsModule,
    // Payouts / withdrawals
    PayoutModule,
    // Recurring billing (Stripe / Lemon Squeezy / Paddle)
    SubscriptionsModule,
  ],
  providers: [
    // Secure-by-default: every route requires a valid JWT unless marked @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Role enforcement runs AFTER the JWT guard so req.user is populated; routes
    // opt in via @Roles(). Order in this array is the execution order.
    { provide: APP_GUARD, useClass: RolesGuard },
    // Global rate limiting (100 req/60s, configured in ThrottlerModule above).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
