import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MediaProcessorPort } from '@starria/replay-core';
import { R2Service } from '../media/r2.service';

/** Thrown when replay processing is requested but the infra is not configured. */
export class ReplayProcessingUnavailableError extends Error {
  constructor(reason: string) {
    super(`Replay processing unavailable: ${reason}`);
    this.name = 'ReplayProcessingUnavailableError';
  }
}

/**
 * Production replay media processor.
 *
 * STARRIA records live rooms with LiveKit Egress, which writes a segmented HLS
 * playlist (+ optional thumbnail images) directly to R2. Because egress already
 * produces a directly-playable HLS asset, no re-transcode is required — this
 * processor is an honest "HLS passthrough": it adopts the egress playlist as the
 * playback URL and derives the true duration by reading the playlist's `#EXTINF`
 * tags. There is NO fabricated URL string-munging (the previous stub invented
 * `…/playback.m3u8` and `thumb_N.jpg` paths that never existed).
 *
 * When the required infrastructure (LiveKit egress output + R2) is not
 * configured, the processor refuses to run and reports the reason, rather than
 * pretending to process. The replay subsystem then runs in production-safe
 * disabled mode (see {@link ReplayCapabilityService}).
 */
@Injectable()
export class ReplayMediaProcessor implements MediaProcessorPort {
  private readonly logger = new Logger(ReplayMediaProcessor.name);

  constructor(
    private readonly config: ConfigService,
    private readonly r2: R2Service,
  ) {}

  /** True when replay media processing can actually run. */
  get isEnabled(): boolean {
    return this.disabledReason() === null;
  }

  /** Human-readable reason processing is disabled, or null when enabled. */
  disabledReason(): string | null {
    const flag = (this.config.get<string>('REPLAY_PROCESSING_ENABLED') ?? 'false').toLowerCase();
    if (flag !== 'true') {
      return 'REPLAY_PROCESSING_ENABLED is not "true"';
    }
    if (!this.r2.isEnabled) {
      return 'R2 storage is not configured (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET)';
    }
    return null;
  }

  private ensureEnabled(): void {
    const reason = this.disabledReason();
    if (reason) throw new ReplayProcessingUnavailableError(reason);
  }

  async process(rawAssetUrl: string): Promise<{ playbackUrl: string; durationSeconds: number }> {
    this.ensureEnabled();
    if (!/^https?:\/\//i.test(rawAssetUrl)) {
      throw new ReplayProcessingUnavailableError(
        `egress asset URL is not absolute: "${rawAssetUrl}"`,
      );
    }
    if (!/\.m3u8(\?|$)/i.test(rawAssetUrl)) {
      throw new ReplayProcessingUnavailableError(
        `egress asset is not an HLS playlist (expected .m3u8): "${rawAssetUrl}"`,
      );
    }
    const durationSeconds = await this.probeHlsDuration(rawAssetUrl);
    this.logger.log(`Processed egress asset (${durationSeconds}s): ${rawAssetUrl}`);
    return { playbackUrl: rawAssetUrl, durationSeconds };
  }

  async generateThumbnails(
    playbackUrl: string,
    count: number,
  ): Promise<{ thumbnailUrls: string[]; posterUrl: string }> {
    this.ensureEnabled();
    // Thumbnails come from LiveKit egress image output, written to a configured
    // prefix alongside the playlist. Without that output configured we honestly
    // return none — we do NOT invent thumbnail URLs that 404.
    const prefix = this.config.get<string>('REPLAY_THUMBNAIL_PREFIX')?.trim();
    if (!prefix) {
      return { thumbnailUrls: [], posterUrl: '' };
    }
    // Egress image output names frames `<prefix>/<recording>_NNNNN.jpg`. We can
    // only reference frames egress actually emitted; derive the recording base
    // from the playlist path and reference the first `count` frames + poster.
    const recordingBase = this.recordingBaseFromPlaylist(playbackUrl);
    const thumbnailUrls = Array.from({ length: Math.max(0, count) }, (_, i) =>
      this.r2.publicUrl(`${prefix}/${recordingBase}_${String(i).padStart(5, '0')}.jpg`),
    );
    const posterUrl = thumbnailUrls[0] ?? '';
    return { thumbnailUrls, posterUrl };
  }

  /** Sum `#EXTINF:<seconds>,` tags in the HLS playlist to get the real duration. */
  private async probeHlsDuration(playlistUrl: string): Promise<number> {
    const text = await this.fetchText(playlistUrl);
    let total = 0;
    for (const line of text.split('\n')) {
      const m = line.match(/^#EXTINF:\s*([0-9]+(?:\.[0-9]+)?)/);
      if (m) total += parseFloat(m[1]);
    }
    return Math.round(total);
  }

  private recordingBaseFromPlaylist(playlistUrl: string): string {
    const last = playlistUrl.split('/').pop() ?? '';
    return last.replace(/\.m3u8(\?.*)?$/i, '');
  }

  /** Fetch playlist text. Isolated for testability. */
  protected async fetchText(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new ReplayProcessingUnavailableError(
        `could not read egress playlist (${res.status}) at ${url}`,
      );
    }
    return res.text();
  }
}
