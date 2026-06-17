import { Module } from '@nestjs/common';
import { DiscoveryModule } from '../discovery/discovery.module';
import { TapController } from './tap.controller';
import { ContentTapService } from './content-tap.service';
import { RegionalBoostService } from './regional-boost.service';
import { FraudSignalsAdapter } from './fraud-signals.adapter';
import { TapAggregationJob } from './tap-aggregation.job';

@Module({
  imports: [DiscoveryModule], // for TrendingComputeService used by the aggregation job
  controllers: [TapController],
  providers: [
    ContentTapService,
    RegionalBoostService,
    FraudSignalsAdapter,
    TapAggregationJob,
  ],
  exports: [ContentTapService, RegionalBoostService],
})
export class ContentTapModule {}
