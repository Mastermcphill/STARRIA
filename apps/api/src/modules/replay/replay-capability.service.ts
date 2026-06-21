import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReplayMediaProcessor } from './replay-media.processor';
import { ReplaysEnabledGuard } from '../../common/replays-enabled.guard';

export interface ReplayCapability {
  /** Master feature switch (REPLAYS_ENABLED) — admin-controlled. */
  featureEnabled: boolean;
  /** Whether the media pipeline can actually process recordings. */
  processingEnabled: boolean;
  /** Why processing is disabled, if it is. */
  processingDisabledReason: string | null;
  /** Whether LiveKit egress is configured to record rooms. */
  egressConfigured: boolean;
  /** Overall: replays usable end-to-end. */
  operational: boolean;
}

/**
 * Reports the live capability of the replay subsystem so operators can see, at a
 * glance, whether replays are working and — if not — exactly which dependency is
 * missing. This backs the production-safe disabled mode: when processing infra
 * is absent, routes return a clean 503 (via {@link ReplaysEnabledGuard}) and
 * this service explains why instead of failing opaquely.
 */
@Injectable()
export class ReplayCapabilityService {
  constructor(
    private readonly config: ConfigService,
    private readonly processor: ReplayMediaProcessor,
  ) {}

  describe(): ReplayCapability {
    const featureEnabled = ReplaysEnabledGuard.isEnabled(this.config);
    const processingDisabledReason = this.processor.disabledReason();
    const processingEnabled = processingDisabledReason === null;
    const egressConfigured =
      !!this.config.get<string>('LIVEKIT_API_KEY') &&
      !!this.config.get<string>('LIVEKIT_API_SECRET') &&
      !!this.config.get<string>('LIVEKIT_URL') &&
      (this.config.get<string>('REPLAY_EGRESS_ENABLED') ?? 'false').toLowerCase() === 'true';

    return {
      featureEnabled,
      processingEnabled,
      processingDisabledReason,
      egressConfigured,
      operational: featureEnabled && processingEnabled,
    };
  }
}
