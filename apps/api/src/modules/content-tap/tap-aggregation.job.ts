// ---------------------------------------------------------------------------
// TapAggregationJob — periodic batch recompute of trending ranks (global +
// regional). Per-video discovery scores are updated immediately by event
// listeners; this job rebuilds the ranked trending rails and fires trend events.
// ---------------------------------------------------------------------------

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { TrendingComputeService } from '../discovery/trending-compute.service';

const INTERVAL_MS = 60_000;

@Injectable()
export class TapAggregationJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TapAggregationJob.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly trendingCompute: TrendingComputeService) {}

  onModuleInit(): void {
    // Disabled under tests to avoid open handles; enabled otherwise.
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      this.runOnce().catch(err => this.logger.error('Aggregation tick failed', err));
    }, INTERVAL_MS);
    this.logger.log(`TapAggregationJob scheduled every ${INTERVAL_MS / 1000}s`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Run a single aggregation pass. Also exposed for manual triggering / tests. */
  async runOnce(): Promise<{ global: number; regional: number }> {
    return this.trendingCompute.recomputeAll();
  }
}
