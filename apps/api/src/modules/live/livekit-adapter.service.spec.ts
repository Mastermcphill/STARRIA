import { ConfigService } from '@nestjs/config';
import { LiveKitAdapterService } from './livekit-adapter.service';

function configWith(values: Record<string, string | undefined>): ConfigService {
  return { get: (k: string) => values[k] } as unknown as ConfigService;
}

describe('LiveKitAdapterService — config validation', () => {
  const full = {
    LIVEKIT_API_KEY: 'key',
    LIVEKIT_API_SECRET: 'secret',
    LIVEKIT_URL: 'wss://example.livekit.cloud',
  };

  it('throws when LIVEKIT_API_KEY is missing', () => {
    expect(() => new LiveKitAdapterService(configWith({ ...full, LIVEKIT_API_KEY: '' })))
      .toThrow(/LIVEKIT_API_KEY/);
  });

  it('throws when LIVEKIT_API_SECRET is missing', () => {
    expect(() => new LiveKitAdapterService(configWith({ ...full, LIVEKIT_API_SECRET: undefined })))
      .toThrow(/LIVEKIT_API_SECRET/);
  });

  it('throws when LIVEKIT_URL is missing', () => {
    expect(() => new LiveKitAdapterService(configWith({ ...full, LIVEKIT_URL: '   ' })))
      .toThrow(/LIVEKIT_URL/);
  });

  it('constructs and issues real JWTs when fully configured', async () => {
    const adapter = new LiveKitAdapterService(configWith(full));
    const token = await adapter.generateToken({
      roomName: 'starria-live-1',
      identity: 'user-1',
      canPublish: true,
      canSubscribe: true,
    });
    // A real signed JWT — never the old "DEV-STUB" sentinel.
    expect(token).not.toContain('DEV-STUB');
    expect(token.split('.')).toHaveLength(3);
  });
});
