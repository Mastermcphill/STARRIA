import { ReplayCapabilityService } from './replay-capability.service';
import { ReplayMediaProcessor } from './replay-media.processor';

function makeConfig(values: Record<string, string>) {
  return { get: (k: string) => values[k] } as any;
}
const r2 = (enabled: boolean) =>
  ({ isEnabled: enabled, publicUrl: (k: string) => k }) as any;

describe('ReplayCapabilityService', () => {
  it('reports fully operational when everything is configured', () => {
    const env = {
      REPLAYS_ENABLED: 'true',
      REPLAY_PROCESSING_ENABLED: 'true',
      REPLAY_EGRESS_ENABLED: 'true',
      LIVEKIT_API_KEY: 'k',
      LIVEKIT_API_SECRET: 's',
      LIVEKIT_URL: 'wss://x',
    };
    const cap = new ReplayCapabilityService(
      makeConfig(env),
      new ReplayMediaProcessor(makeConfig(env), r2(true)),
    );
    const d = cap.describe();
    expect(d.operational).toBe(true);
    expect(d.processingEnabled).toBe(true);
    expect(d.egressConfigured).toBe(true);
    expect(d.processingDisabledReason).toBeNull();
  });

  it('explains why it is disabled when nothing is configured', () => {
    const cap = new ReplayCapabilityService(
      makeConfig({}),
      new ReplayMediaProcessor(makeConfig({}), r2(false)),
    );
    const d = cap.describe();
    expect(d.operational).toBe(false);
    expect(d.featureEnabled).toBe(false);
    expect(d.processingDisabledReason).toBeTruthy();
    expect(d.egressConfigured).toBe(false);
  });
});
