import { TokenRevocationService } from './token-revocation.service';
import type { JwtPayload } from './jwt.strategy';

/**
 * Minimal in-memory ioredis fake: just the SET (with EX) / GET / EXISTS surface
 * the revocation store uses. TTL is recorded so we can assert it, but keys do
 * not auto-expire within a synchronous test.
 */
class FakeRedis {
  store = new Map<string, string>();
  ttls = new Map<string, number>();

  async set(key: string, value: string, _mode: 'EX', ttl: number) {
    this.store.set(key, value);
    this.ttls.set(key, ttl);
    return 'OK';
  }
  async get(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  async exists(key: string) {
    return this.store.has(key) ? 1 : 0;
  }
}

const nowSec = () => Math.floor(Date.now() / 1000);

const payload = (over: Partial<JwtPayload> = {}): JwtPayload => ({
  sub: 'user-1',
  email: 'a@b.c',
  role: 'USER',
  jti: 'jti-1',
  iat: nowSec(),
  exp: nowSec() + 3600,
  ...over,
});

describe('TokenRevocationService', () => {
  let redis: FakeRedis;
  let svc: TokenRevocationService;

  beforeEach(() => {
    redis = new FakeRedis();
    svc = new TokenRevocationService(redis as never);
  });

  it('a fresh token is not revoked', async () => {
    expect(await svc.isRevoked(payload())).toBe(false);
  });

  it('revokes a single session by jti and leaves other sessions alive', async () => {
    await svc.revokeSession('jti-1', nowSec() + 3600);
    expect(await svc.isRevoked(payload({ jti: 'jti-1' }))).toBe(true);
    // A different session for the same user is unaffected.
    expect(await svc.isRevoked(payload({ jti: 'jti-2' }))).toBe(false);
  });

  it('sets the session deny-key TTL to the token remaining lifetime', async () => {
    const exp = nowSec() + 1800;
    await svc.revokeSession('jti-1', exp);
    const ttl = redis.ttls.get('revoked:jti:jti-1')!;
    expect(ttl).toBeGreaterThan(1700);
    expect(ttl).toBeLessThanOrEqual(1800);
  });

  it('does not write a deny-key for an already-expired token', async () => {
    await svc.revokeSession('jti-old', nowSec() - 10);
    expect(redis.store.has('revoked:jti:jti-old')).toBe(false);
  });

  it('revoke-all invalidates every token issued at or before the cutoff', async () => {
    const oldToken = payload({ iat: nowSec() - 100, jti: 'jti-old' });
    await svc.revokeAllForUser('user-1');
    expect(await svc.isRevoked(oldToken)).toBe(true);
  });

  it('revoke-all does not affect a different user', async () => {
    await svc.revokeAllForUser('user-1');
    expect(await svc.isRevoked(payload({ sub: 'user-2', iat: nowSec() - 100 }))).toBe(false);
  });

  it('a token minted after revoke-all is still valid', async () => {
    await svc.revokeAllForUser('user-1');
    // Issued one second in the future relative to the cutoff.
    const future = payload({ iat: nowSec() + 1, jti: 'jti-new' });
    expect(await svc.isRevoked(future)).toBe(false);
  });
});
