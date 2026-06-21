import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsEventStore } from './analytics-event.store';
import { CreatorAnalyticsAggregator } from './creator-analytics.aggregator';
import { MonitoringService } from './monitoring.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsEventStore, CreatorAnalyticsAggregator, MonitoringService],
  exports: [AnalyticsEventStore, CreatorAnalyticsAggregator, MonitoringService],
})
export class AnalyticsModule {}
