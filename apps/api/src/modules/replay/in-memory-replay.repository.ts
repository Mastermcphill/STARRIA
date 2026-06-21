// ---------------------------------------------------------------------------
// replay — Media processor stub, discovery publisher, and access gate.
// The replay STORE is now Prisma-backed (see prisma-replay.repository.ts).
// These remaining adapters are external/stub ports: the media transcode
// processor, the discovery-feed publisher, and the subscriber/premium access
// gate (replaced by real transcode + wallet/subscription wiring in a later
// infra sprint). See the Sprint 10 audit.
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import type {
  DiscoveryPublisherPort,
  ReplayAccessPort,
  Replay,
} from '@starria/replay-core';

const DISCOVERY_FEED: string[] = [];

@Injectable()
export class InMemoryDiscoveryPublisher implements DiscoveryPublisherPort {
  async pushReplay(replay: Replay): Promise<void> {
    DISCOVERY_FEED.push(replay.id);
  }
}

/**
 * Subscriber/premium gate. In-memory entitlements; real impl checks the
 * wallet / subscription ledger.
 */
@Injectable()
export class InMemoryReplayAccess implements ReplayAccessPort {
  private entitlements = new Map<string, Set<string>>(); // userId -> replayIds

  grant(userId: string, replayId: string): void {
    if (!this.entitlements.has(userId)) this.entitlements.set(userId, new Set());
    this.entitlements.get(userId)!.add(replayId);
  }

  async checkAccess(replay: Replay, userId: string): Promise<string | null> {
    if (replay.visibility === 'PUBLIC') return null;
    if (this.entitlements.get(userId)?.has(replay.id)) return null;
    if (replay.visibility === 'PREMIUM') {
      return 'This is a premium replay. Purchase required to watch.';
    }
    return 'This replay is for subscribers only.';
  }
}
