import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';
import type { JwtPayload } from './jwt.strategy';

/**
 * Redis-backed JWT revocation store.
 *
 * Two revocation mechanisms, both expressed against already-issued tokens
 * (we never mutate the signed token — we maintain a deny-side index):
 *
 *  1. Per-session: `revoked:jti:<jti>` marks a single access token dead. Used
 *     by logout and single-session revocation. TTL = the token's own remaining
 *     lifetime, so the key self-expires exactly when the token would anyway.
 *
 *  2. Per-user cutoff: `revoked:user:<userId>` holds an epoch-seconds watermark.
 *     Any token whose `iat` is at/before the watermark is rejected. Used by
 *     "revoke all sessions" and account suspension — a single O(1) write
 *     invalidates every token the user currently holds, including refresh
 *     tokens. TTL = the longest possible token lifetime so the watermark
 *     outlives every token it must invalidate.
 */
@Injectable()
export class TokenRevocationService {
  private readonly logger = new Logger(TokenRevocationService.name);

  // Watermark must outlive the longest-lived token (refresh, default 30d).
  // Configurable via REVOCATION_WATERMARK_TTL_SECONDS; generous default.
  private readonly watermarkTtlSeconds: number;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    const fromEnv = Number(process.env.REVOCATION_WATERMARK_TTL_SECONDS);
    this.watermarkTtlSeconds =
      Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 60 * 60 * 24 * 31; // 31 days
  }

  private static sessionKey(jti: string): string {
    return `revoked:jti:${jti}`;
  }

  private static userKey(userId: string): string {
    return `revoked:user:${userId}`;
  }

  private static nowSeconds(): number {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * Revoke a single access token by its `jti`. `exp` is the token's epoch-seconds
   * expiry; the deny key is set to expire at the same moment so Redis self-cleans.
   */
  async revokeSession(jti: string, exp?: number): Promise<void> {
    if (!jti) return;
    const ttl = exp ? exp - TokenRevocationService.nowSeconds() : this.watermarkTtlSeconds;
    if (ttl <= 0) return; // already expired — nothing to deny
    await this.redis.set(TokenRevocationService.sessionKey(jti), '1', 'EX', ttl);
    this.logger.log(`Session revoked (jti=${jti}, ttl=${ttl}s)`);
  }

  /**
   * Revoke every token currently held by a user (all sessions + refresh tokens)
   * by advancing the per-user watermark to now. Idempotent.
   */
  async revokeAllForUser(userId: string): Promise<void> {
    if (!userId) return;
    const cutoff = TokenRevocationService.nowSeconds();
    await this.redis.set(
      TokenRevocationService.userKey(userId),
      String(cutoff),
      'EX',
      this.watermarkTtlSeconds,
    );
    this.logger.log(`All sessions revoked for user ${userId} (cutoff=${cutoff})`);
  }

  /**
   * True if the token described by this payload has been revoked, either as an
   * individual session (jti deny key) or by the user's revoke-all watermark.
   */
  async isRevoked(payload: JwtPayload): Promise<boolean> {
    if (payload.jti) {
      const denied = await this.redis.exists(TokenRevocationService.sessionKey(payload.jti));
      if (denied) return true;
    }
    if (payload.sub && typeof payload.iat === 'number') {
      const raw = await this.redis.get(TokenRevocationService.userKey(payload.sub));
      if (raw !== null) {
        const cutoff = Number(raw);
        // Tokens issued at or before the cutoff second are revoked. Using <=
        // closes the same-second race where a token is minted and the user is
        // revoked within the same wall-clock second.
        if (Number.isFinite(cutoff) && payload.iat <= cutoff) return true;
      }
    }
    return false;
  }
}
