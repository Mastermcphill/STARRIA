// ---------------------------------------------------------------------------
// creator-os-core — PosterStudioService (Sprint 7, Phase 4)
// AI poster generation with coin payment. Comedy / AI-movie / live-show / arena.
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type { EventBus } from '@starria/domain-events';
import type {
  PosterRequest,
  PosterResult,
  PosterGeneratorPort,
  CreatorCoinLedgerPort,
} from './studio.types';
import { POSTER_COIN_COST } from './studio.types';
import { buildPosterStudioGenerated } from './studio.events';

export interface PosterStudioDeps {
  generator: PosterGeneratorPort;
  ledger: CreatorCoinLedgerPort;
  eventBus?: EventBus;
}

export class PosterStudioService {
  constructor(private readonly deps: PosterStudioDeps) {}

  async generate(req: PosterRequest): Promise<PosterResult> {
    const cost = POSTER_COIN_COST[req.posterType];

    // Charge first; refund on generation failure.
    await this.deps.ledger.charge(req.creatorId, cost, `poster:${req.posterType}`);

    let imageUrl: string;
    let thumbnailUrl: string;
    try {
      const out = await this.deps.generator.generate(req);
      imageUrl = out.imageUrl;
      thumbnailUrl = out.thumbnailUrl;
    } catch (err) {
      await this.deps.ledger.credit(req.creatorId, cost, `poster.refund:${req.posterType}`);
      throw err;
    }

    const result: PosterResult = {
      id: randomUUID(),
      creatorId: req.creatorId,
      posterType: req.posterType,
      resultImageUrl: imageUrl,
      thumbnailUrl,
      coinsCharged: cost,
      generatedAt: new Date().toISOString(),
    };

    this.deps.eventBus?.publish(buildPosterStudioGenerated({
      posterId: result.id, creatorId: result.creatorId, posterType: result.posterType,
      resultImageUrl: result.resultImageUrl, coinsCharged: result.coinsCharged, generatedAt: result.generatedAt,
    }));

    return result;
  }
}
