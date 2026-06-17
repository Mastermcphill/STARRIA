// Implements video-core VideoSearchIndexPort.
// Search documents are sourced live from the Video table (see search module),
// so indexing is a no-op marker here; kept as a seam for a future dedicated
// search index (OpenSearch / Meilisearch).

import { Injectable, Logger } from '@nestjs/common';
import type { VideoSearchIndexPort, VideoRecord } from '@starria/video-core';

@Injectable()
export class VideoSearchIndexAdapter implements VideoSearchIndexPort {
  private readonly logger = new Logger(VideoSearchIndexAdapter.name);

  async index(video: VideoRecord): Promise<void> {
    this.logger.debug(`Indexed video ${video.id} (${video.genre})`);
  }

  async deindex(videoId: string): Promise<void> {
    this.logger.debug(`Deindexed video ${videoId}`);
  }
}
