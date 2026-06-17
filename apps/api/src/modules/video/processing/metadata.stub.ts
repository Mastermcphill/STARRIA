// Metadata extractor stub — replace with ffprobe / AI tagging.
import { Injectable, Logger } from '@nestjs/common';
import type { MetadataExtractorPort, ExtractedMetadata } from '@starria/video-core';

@Injectable()
export class MetadataExtractorStub implements MetadataExtractorPort {
  private readonly logger = new Logger(MetadataExtractorStub.name);

  async extract(input: { videoId: string; storageKey: string }): Promise<ExtractedMetadata> {
    this.logger.warn(`[STUB] metadata ${input.videoId}`);
    return {
      durationSeconds: 60,
      width: 1080,
      height: 1920,
      codec: 'h264',
      detectedLanguage: 'en',
      suggestedTags: [],
    };
  }
}
