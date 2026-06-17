import { Module } from '@nestjs/common';
import { DiscoveryController } from './discovery.controller';
import { PrismaDiscoveryFeedAdapter } from './prisma-discovery-feed.adapter';
import { PrismaTrendingStoreAdapter } from './prisma-trending-store.adapter';
import { DiscoveryScoringService } from './discovery-scoring.service';
import { TrendingComputeService } from './trending-compute.service';
import { DiscoveryListeners } from './discovery.listeners';

@Module({
  controllers: [DiscoveryController],
  providers: [
    PrismaDiscoveryFeedAdapter,
    PrismaTrendingStoreAdapter,
    DiscoveryScoringService,
    TrendingComputeService,
    DiscoveryListeners,
  ],
  exports: [DiscoveryScoringService, TrendingComputeService],
})
export class DiscoveryModule {}
