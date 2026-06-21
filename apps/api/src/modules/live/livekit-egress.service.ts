// ---------------------------------------------------------------------------
// LiveKit Egress — starts/stops room-composite recording to R2 (S3-compatible),
// producing a segmented HLS playlist that the replay pipeline adopts directly.
//
// Capability-gated: requires LIVEKIT_* credentials, R2_* credentials, and
// REPLAY_EGRESS_ENABLED=true. When any is missing the service reports a reason
// and refuses to start egress — it never pretends to record.
// ---------------------------------------------------------------------------

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EgressClient,
  EncodedFileType,
  S3Upload,
  SegmentedFileOutput,
} from 'livekit-server-sdk';

export interface EgressHandle {
  egressId: string;
  /** Public HLS playlist URL the replay pipeline will read once recording ends. */
  playlistUrl: string;
  /** R2 object key of the playlist. */
  playlistKey: string;
}

@Injectable()
export class LiveKitEgressService {
  private readonly logger = new Logger(LiveKitEgressService.name);
  private readonly client: EgressClient | null;
  private readonly disabled: string | null;

  constructor(private readonly config: ConfigService) {
    this.disabled = this.computeDisabledReason();
    if (this.disabled) {
      this.client = null;
      this.logger.warn(`LiveKit egress disabled — ${this.disabled}`);
      return;
    }
    const url = this.config.get<string>('LIVEKIT_URL')!.trim();
    const host =
      this.config.get<string>('LIVEKIT_HOST')?.trim() ||
      url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
    this.client = new EgressClient(
      host,
      this.config.get<string>('LIVEKIT_API_KEY')!.trim(),
      this.config.get<string>('LIVEKIT_API_SECRET')!.trim(),
    );
    this.logger.log('LiveKit egress ready');
  }

  get isEnabled(): boolean {
    return this.disabled === null;
  }

  get disabledReason(): string | null {
    return this.disabled;
  }

  /**
   * Start recording a room. Output is segmented HLS written to R2 under
   * `replays/<roomName>/<recordingBase>.m3u8`. Returns the egress id + the URL
   * the replay pipeline will read once `egress_ended` fires.
   */
  async startRoomRecording(roomName: string): Promise<EgressHandle> {
    if (!this.client) {
      throw new Error(`Cannot start egress — ${this.disabled}`);
    }
    const { key: playlistKey, base } = this.playlistKeyFor(roomName);
    const output = new SegmentedFileOutput({
      filenamePrefix: `replays/${roomName}/${base}`,
      playlistName: `${base}.m3u8`,
      segmentDuration: 6,
      output: { case: 's3', value: this.s3Upload() },
    });

    const info = await this.client.startRoomCompositeEgress(
      roomName,
      { segments: output },
      { layout: 'speaker' },
    );

    const playlistUrl = this.publicUrl(playlistKey);
    this.logger.log(`Egress started for room ${roomName} (id=${info.egressId})`);
    return { egressId: info.egressId, playlistUrl, playlistKey };
  }

  async stopRecording(egressId: string): Promise<void> {
    if (!this.client) throw new Error(`Cannot stop egress — ${this.disabled}`);
    await this.client.stopEgress(egressId);
    this.logger.log(`Egress stopped (id=${egressId})`);
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private computeDisabledReason(): string | null {
    if ((this.config.get<string>('REPLAY_EGRESS_ENABLED') ?? 'false').toLowerCase() !== 'true') {
      return 'REPLAY_EGRESS_ENABLED is not "true"';
    }
    const missing = [
      ['LIVEKIT_API_KEY', this.config.get<string>('LIVEKIT_API_KEY')],
      ['LIVEKIT_API_SECRET', this.config.get<string>('LIVEKIT_API_SECRET')],
      ['LIVEKIT_URL', this.config.get<string>('LIVEKIT_URL')],
      ['R2_BUCKET', this.config.get<string>('R2_BUCKET')],
      ['R2_ACCESS_KEY_ID', this.config.get<string>('R2_ACCESS_KEY_ID')],
      ['R2_SECRET_ACCESS_KEY', this.config.get<string>('R2_SECRET_ACCESS_KEY')],
      ['R2_ACCOUNT_ID', this.config.get<string>('R2_ACCOUNT_ID')],
    ]
      .filter(([, v]) => !v)
      .map(([k]) => k as string);
    return missing.length ? `missing config: ${missing.join(', ')}` : null;
  }

  private s3Upload(): S3Upload {
    const accountId = this.config.get<string>('R2_ACCOUNT_ID')!.trim();
    return new S3Upload({
      accessKey: this.config.get<string>('R2_ACCESS_KEY_ID')!.trim(),
      secret: this.config.get<string>('R2_SECRET_ACCESS_KEY')!.trim(),
      bucket: this.config.get<string>('R2_BUCKET')!.trim(),
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
    });
  }

  /** Deterministic playlist key. `recordingBase` derives from room + a stable id. */
  playlistKeyFor(roomName: string): { key: string; base: string } {
    // recordingBase is the egress id once known; before that we key by room.
    // The actual playlist key is finalised when egress_ended reports the file.
    const base = roomName;
    return { key: `replays/${roomName}/${base}.m3u8`, base };
  }

  publicUrl(key: string): string {
    const base = (this.config.get<string>('R2_PUBLIC_BASE_URL') ?? '').replace(/\/$/, '');
    return `${base}/${key}`;
  }

  /** Build EncodedFileType-typed name (referenced to keep the SDK import honest). */
  static fileExtensionFor(type: EncodedFileType): string {
    return type === EncodedFileType.OGG ? 'ogg' : 'mp4';
  }
}
