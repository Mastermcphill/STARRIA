// ---------------------------------------------------------------------------
// creator-os-core — ClipService (Sprint 7, Phase 7)
// Discovery flywheel: auto-cut 15/30/60s clips + teasers from replays.
// Live → Replay → Discovery → Support → Patrons → Next Live Event.
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type { EventBus } from '@starria/domain-events';
import type {
  Clip,
  GenerateClipsInput,
  ClipLength,
  ClipStorePort,
  ClipGeneratorPort,
} from './studio.types';
import { buildClipGenerated, buildTeaserGenerated } from './studio.events';

export interface ClipDeps {
  store: ClipStorePort;
  generator: ClipGeneratorPort;
  eventBus?: EventBus;
}

const DEFAULT_LENGTHS: ClipLength[] = [15, 30, 60];

export class ClipService {
  constructor(private readonly deps: ClipDeps) {}

  /**
   * Generate a set of clips from a replay. If explicit highlight offsets are
   * provided they are used; otherwise highlights are spread across the replay
   * (early hook, midpoint, climax) so a length always fits inside the source.
   */
  async generateClips(input: GenerateClipsInput): Promise<Clip[]> {
    const lengths = input.lengths ?? DEFAULT_LENGTHS;
    const now = new Date().toISOString();
    const clips: Clip[] = [];

    lengths.forEach((length, idx) => {
      // pick an offset; never exceed source duration.
      let offset: number;
      if (input.highlightOffsets && input.highlightOffsets[idx] !== undefined) {
        offset = input.highlightOffsets[idx];
      } else {
        // spread: 10%, 45%, 75% of the timeline as default highlight anchors.
        const anchors = [0.1, 0.45, 0.75];
        offset = Math.floor(input.durationSeconds * anchors[idx % anchors.length]);
      }
      offset = Math.max(0, Math.min(offset, Math.max(0, input.durationSeconds - length)));
      clips.push({ id: randomUUID(), sourceReplayId: input.sourceReplayId, creatorId: input.creatorId,
        lengthSeconds: length, startOffsetSeconds: offset, clipUrl: '', generatedAt: now });
    });

    const persisted: Clip[] = [];
    for (const clip of clips) {
      const { clipUrl } = await this.deps.generator.cut(input.sourceReplayId, clip.startOffsetSeconds, clip.lengthSeconds);
      const finalClip = { ...clip, clipUrl };
      await this.deps.store.create(finalClip);
      this.deps.eventBus?.publish(buildClipGenerated({
        clipId: finalClip.id, sourceReplayId: finalClip.sourceReplayId, creatorId: finalClip.creatorId,
        lengthSeconds: finalClip.lengthSeconds, clipUrl: finalClip.clipUrl,
        startOffsetSeconds: finalClip.startOffsetSeconds, generatedAt: now,
      }));
      persisted.push(finalClip);
    }

    return persisted;
  }

  /** Generate a single short teaser (uses the shortest clip length). */
  async generateTeaser(input: { sourceReplayId: string; creatorId: string; durationSeconds: number }): Promise<{ teaserId: string; teaserUrl: string }> {
    const offset = Math.floor(input.durationSeconds * 0.1);
    const { clipUrl } = await this.deps.generator.cut(input.sourceReplayId, offset, 15);
    const teaserId = randomUUID();
    this.deps.eventBus?.publish(buildTeaserGenerated({
      teaserId, sourceReplayId: input.sourceReplayId, creatorId: input.creatorId,
      teaserUrl: clipUrl, generatedAt: new Date().toISOString(),
    }));
    return { teaserId, teaserUrl: clipUrl };
  }

  listByReplay(replayId: string) { return this.deps.store.listByReplay(replayId); }
}
