import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const WEBHOOK_SOURCE_KEY = 'webhook_source';

/**
 * Tag a webhook route with the env var holding its allowed source IPs/CIDRs.
 * Example: `@WebhookSource('PAYSTACK_WEBHOOK_IPS')`.
 */
export const WebhookSource = (envVar: string) => SetMetadata(WEBHOOK_SOURCE_KEY, envVar);

/**
 * Restrict a webhook route to a configured set of source IPs (defence in depth
 * alongside HMAC signature verification). The allowlist is a comma-separated
 * list of IPv4/IPv6 addresses or CIDR ranges in the named env var.
 *
 * When the env var is unset the guard allows the request (so local/dev and
 * not-yet-configured deployments are not broken) but logs a warning. Set the
 * allowlist in production to enforce.
 */
@Injectable()
export class WebhookIpAllowlistGuard implements CanActivate {
  private readonly logger = new Logger(WebhookIpAllowlistGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const envVar = this.reflector.getAllAndOverride<string>(WEBHOOK_SOURCE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const raw = (envVar && process.env[envVar]) || '';
    const allow = raw.split(',').map((s) => s.trim()).filter(Boolean);

    if (allow.length === 0) {
      this.logger.warn(
        `Webhook IP allowlist (${envVar ?? 'unconfigured'}) is empty — allowing all sources. ` +
          'Set it in production to restrict callers.',
      );
      return true;
    }

    const req = context.switchToHttp().getRequest<{ ip?: string; ips?: string[] }>();
    const clientIp = this.clientIp(req);
    if (!clientIp) {
      throw new ForbiddenException('Could not determine source IP for webhook');
    }

    if (!allow.some((entry) => WebhookIpAllowlistGuard.matches(clientIp, entry))) {
      this.logger.warn(`Rejected webhook from disallowed IP ${clientIp}`);
      throw new ForbiddenException('Source IP not allowed');
    }
    return true;
  }

  private clientIp(req: { ip?: string; ips?: string[] }): string | null {
    // Fastify populates req.ip (honours trustProxy). ips[] is the XFF chain.
    return req.ip ?? req.ips?.[0] ?? null;
  }

  /** Exact match or CIDR (IPv4) containment. */
  static matches(ip: string, entry: string): boolean {
    const normalized = ip.replace(/^::ffff:/, ''); // unwrap IPv4-mapped IPv6
    if (!entry.includes('/')) {
      return normalized === entry || ip === entry;
    }
    const [range, bitsStr] = entry.split('/');
    const bits = parseInt(bitsStr, 10);
    const ipNum = WebhookIpAllowlistGuard.ipv4ToInt(normalized);
    const rangeNum = WebhookIpAllowlistGuard.ipv4ToInt(range);
    if (ipNum === null || rangeNum === null || !Number.isFinite(bits)) return false;
    if (bits <= 0) return true;
    const mask = bits >= 32 ? 0xffffffff : (0xffffffff << (32 - bits)) >>> 0;
    return (ipNum & mask) === (rangeNum & mask);
  }

  private static ipv4ToInt(ip: string): number | null {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;
    let n = 0;
    for (const p of parts) {
      const o = Number(p);
      if (!Number.isInteger(o) || o < 0 || o > 255) return null;
      n = (n << 8) | o;
    }
    return n >>> 0;
  }
}
