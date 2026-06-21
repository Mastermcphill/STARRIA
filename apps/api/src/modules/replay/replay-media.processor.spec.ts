import {
  ReplayMediaProcessor,
  ReplayProcessingUnavailableError,
} from './replay-media.processor';

function makeConfig(values: Record<string, string>) {
  return { get: (k: string) => values[k] } as any;
}
const r2 = (enabled: boolean) =>
  ({ isEnabled: enabled, publicUrl: (k: string) => `https://cdn.test/${k}` }) as any;

/** Subclass to stub the network fetch of the playlist. */
class TestProcessor extends ReplayMediaProcessor {
  constructor(config: any, r2svc: any, private readonly playlist: string) {
    super(config, r2svc);
  }
  protected async fetchText(): Promise<string> {
    return this.playlist;
  }
}

const ENABLED = { REPLAY_PROCESSING_ENABLED: 'true' };

describe('ReplayMediaProcessor', () => {
  describe('disabled mode', () => {
    it('reports a reason when the flag is off', () => {
      const p = new ReplayMediaProcessor(makeConfig({}), r2(true));
      expect(p.isEnabled).toBe(false);
      expect(p.disabledReason()).toMatch(/REPLAY_PROCESSING_ENABLED/);
    });

    it('reports a reason when R2 is unconfigured', () => {
      const p = new ReplayMediaProcessor(makeConfig(ENABLED), r2(false));
      expect(p.isEnabled).toBe(false);
      expect(p.disabledReason()).toMatch(/R2/);
    });

    it('throws ReplayProcessingUnavailableError instead of faking output', async () => {
      const p = new ReplayMediaProcessor(makeConfig({}), r2(true));
      await expect(p.process('https://cdn.test/x.m3u8')).rejects.toBeInstanceOf(
        ReplayProcessingUnavailableError,
      );
    });
  });

  describe('enabled (HLS passthrough)', () => {
    const playlist = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXTINF:6.0,',
      'seg0.ts',
      '#EXTINF:6.0,',
      'seg1.ts',
      '#EXTINF:4.5,',
      'seg2.ts',
      '#EXT-X-ENDLIST',
    ].join('\n');

    it('adopts the egress playlist URL and probes real duration', async () => {
      const p = new TestProcessor(makeConfig(ENABLED), r2(true), playlist);
      const out = await p.process('https://cdn.test/replays/room/room.m3u8');
      expect(out.playbackUrl).toBe('https://cdn.test/replays/room/room.m3u8');
      expect(out.durationSeconds).toBe(17); // 6 + 6 + 4.5 → 16.5 → round 17
    });

    it('rejects non-HLS assets rather than munging a fake URL', async () => {
      const p = new TestProcessor(makeConfig(ENABLED), r2(true), playlist);
      await expect(p.process('https://cdn.test/raw.mp4')).rejects.toBeInstanceOf(
        ReplayProcessingUnavailableError,
      );
    });

    it('returns no thumbnails when egress image output is not configured', async () => {
      const p = new TestProcessor(makeConfig(ENABLED), r2(true), playlist);
      const t = await p.generateThumbnails('https://cdn.test/replays/room/room.m3u8', 4);
      expect(t.thumbnailUrls).toEqual([]);
      expect(t.posterUrl).toBe('');
    });

    it('derives thumbnail URLs from the configured egress prefix', async () => {
      const p = new TestProcessor(
        makeConfig({ ...ENABLED, REPLAY_THUMBNAIL_PREFIX: 'thumbs' }),
        r2(true),
        playlist,
      );
      const t = await p.generateThumbnails('https://cdn.test/replays/room/room.m3u8', 2);
      expect(t.thumbnailUrls).toHaveLength(2);
      expect(t.thumbnailUrls[0]).toBe('https://cdn.test/thumbs/room_00000.jpg');
      expect(t.posterUrl).toBe('https://cdn.test/thumbs/room_00000.jpg');
    });
  });
});
