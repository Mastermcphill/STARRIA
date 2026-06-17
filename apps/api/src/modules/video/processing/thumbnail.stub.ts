// Thumbnail generator stub — replace with a real frame-grab worker.
import { Injectable, Logger } from '@nestjs/common';
import type { ThumbnailGeneratorPort, ThumbnailResult } from '@starria/video-core';

@Injectable()
export class ThumbnailGeneratorStub implements ThumbnailGeneratorPort {
  private readonly logger = new Logger(ThumbnailGeneratorStub.name);

  async generate(input: { videoId: string; storageKey: string; atSeconds?: number }): Promise<ThumbnailResult> {
    this.logger.warn(`[STUB] thumbnail ${input.videoId}`);
    return { thumbnailUrl: `https://cdn.starria.stub/${input.videoId}/thumb.jpg` };
  }
}
