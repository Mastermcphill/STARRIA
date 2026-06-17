import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { EventBusModule } from './event-bus/event-bus.module';

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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    RedisModule,
    EventBusModule,   // global — provides EVENT_BUS token
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
  ],
})
export class AppModule {}
