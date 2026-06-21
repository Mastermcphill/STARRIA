import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReplaysEnabledGuard } from './replays-enabled.guard';

function config(value: string | undefined): ConfigService {
  return { get: jest.fn().mockReturnValue(value) } as unknown as ConfigService;
}

const ctx = {} as any;

describe('ReplaysEnabledGuard', () => {
  it('blocks with 503 when the flag is unset', () => {
    const guard = new ReplaysEnabledGuard(config(undefined));
    expect(() => guard.canActivate(ctx)).toThrow(ServiceUnavailableException);
  });

  it('blocks when the flag is false', () => {
    const guard = new ReplaysEnabledGuard(config('false'));
    expect(() => guard.canActivate(ctx)).toThrow(ServiceUnavailableException);
  });

  it('allows when the flag is exactly true (case-insensitive)', () => {
    expect(new ReplaysEnabledGuard(config('true')).canActivate(ctx)).toBe(true);
    expect(new ReplaysEnabledGuard(config('TRUE')).canActivate(ctx)).toBe(true);
  });

  it('does not enable on near-miss values', () => {
    expect(() => new ReplaysEnabledGuard(config('1')).canActivate(ctx)).toThrow(ServiceUnavailableException);
    expect(() => new ReplaysEnabledGuard(config('yes')).canActivate(ctx)).toThrow(ServiceUnavailableException);
  });
});
