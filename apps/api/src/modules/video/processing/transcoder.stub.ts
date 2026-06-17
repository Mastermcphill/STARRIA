// Transcoder stub — replace with real FFmpeg / Mux / Cloudflare Stream worker.
import { Injectable, Logger } from '@nestjs/common';
import type { TranscoderPort, TranscodeResult } from '@starria/video-core';

@Injectable()
export class TranscoderStub implements TranscoderPort {
  private readonly logger = new Logger(TranscoderStub.name);

  async transcode(input: { videoId: string; storageKey: string }): Promise<TranscodeResult> {
    this.logger.warn(`[STUB] transcode ${input.videoId} (${input.storageKey})`);
    return {
      playbackUrl: `https://cdn.starria.stub/${input.videoId}/playback.m3u8`,
      durationSeconds: 60,
      width: 1080,
      height: 1920,
    };
  }
}
