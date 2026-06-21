import { ForbiddenException } from '@nestjs/common';
import { WebhookIpAllowlistGuard, WEBHOOK_SOURCE_KEY } from './webhook-ip.guard';

function ctx(ip: string, envVar = 'TEST_WEBHOOK_IPS') {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ ip }) }),
  } as any;
}
function reflectorReturning(envVar: string | undefined) {
  return { getAllAndOverride: () => envVar } as any;
}

describe('WebhookIpAllowlistGuard', () => {
  afterEach(() => {
    delete process.env.TEST_WEBHOOK_IPS;
  });

  it('allows all when the allowlist env is unset', () => {
    const g = new WebhookIpAllowlistGuard(reflectorReturning('TEST_WEBHOOK_IPS'));
    expect(g.canActivate(ctx('1.2.3.4'))).toBe(true);
  });

  it('allows an exact-match IP', () => {
    process.env.TEST_WEBHOOK_IPS = '52.31.139.75, 52.49.173.169';
    const g = new WebhookIpAllowlistGuard(reflectorReturning('TEST_WEBHOOK_IPS'));
    expect(g.canActivate(ctx('52.49.173.169'))).toBe(true);
  });

  it('rejects a non-allowlisted IP', () => {
    process.env.TEST_WEBHOOK_IPS = '52.31.139.75';
    const g = new WebhookIpAllowlistGuard(reflectorReturning('TEST_WEBHOOK_IPS'));
    expect(() => g.canActivate(ctx('8.8.8.8'))).toThrow(ForbiddenException);
  });

  it('matches inside a CIDR range', () => {
    process.env.TEST_WEBHOOK_IPS = '52.31.0.0/16';
    const g = new WebhookIpAllowlistGuard(reflectorReturning('TEST_WEBHOOK_IPS'));
    expect(g.canActivate(ctx('52.31.200.10'))).toBe(true);
    expect(() => g.canActivate(ctx('52.32.0.1'))).toThrow(ForbiddenException);
  });

  it('unwraps IPv4-mapped IPv6 addresses', () => {
    process.env.TEST_WEBHOOK_IPS = '52.31.139.75';
    const g = new WebhookIpAllowlistGuard(reflectorReturning('TEST_WEBHOOK_IPS'));
    expect(g.canActivate(ctx('::ffff:52.31.139.75'))).toBe(true);
  });

  it('matches() handles /32 and /0', () => {
    expect(WebhookIpAllowlistGuard.matches('1.2.3.4', '1.2.3.4/32')).toBe(true);
    expect(WebhookIpAllowlistGuard.matches('9.9.9.9', '0.0.0.0/0')).toBe(true);
  });

  it('exposes the metadata key for @WebhookSource', () => {
    expect(WEBHOOK_SOURCE_KEY).toBe('webhook_source');
  });
});
