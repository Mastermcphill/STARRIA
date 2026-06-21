import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  type PaymentCapability,
  allProviderCapabilities,
  enabledEnvVar,
  getCatalogEntry,
  providerSupports,
} from './provider-catalog';

/**
 * Resolved on/off state of a single (provider, capability) pair, with the
 * inputs that produced it — so the admin console can show *why* something is
 * on or off.
 */
export interface ResolvedProviderState {
  provider: string;
  label: string;
  capability: PaymentCapability;
  /** Credentials present in the environment. */
  configured: boolean;
  /** Env default flag, if PAYMENTS_<P>_<C>_ENABLED is set ("true"/"false"). */
  envDefault: boolean | null;
  /** DB override (ProviderSetting.enabled), if a row forces it. */
  override: boolean | null;
  /** Final answer after applying precedence. */
  enabled: boolean;
}

const CACHE_TTL_MS = 30_000;

/**
 * The toggle layer. Effective state of a (provider, capability) is resolved by
 * precedence:
 *
 *   1. DB override   (ProviderSetting.enabled, when non-null)  ── admin runtime
 *   2. Env default   (PAYMENTS_<P>_<C>_ENABLED = true|false)   ── Render/Railway
 *   3. Configured?   (credential env var is non-empty)         ── safe fallback
 *
 * A provider can never be enabled for a capability it doesn't support, nor when
 * its credentials are missing — `isEnabled()` enforces both regardless of the
 * stored flags, so a stale "true" can't route money to an unconfigured rail.
 */
@Injectable()
export class ProviderToggleService {
  private readonly logger = new Logger(ProviderToggleService.name);
  // Short-TTL cache of DB overrides so the hot payment path doesn't hit the DB
  // on every call. Invalidated immediately on any admin write.
  private overrideCache: Map<string, boolean | null> | null = null;
  private overrideCacheAt = 0;

  constructor(
    private readonly config: ConfigService,
    private readonly db: PrismaService,
  ) {}

  /** Fast boolean check for the payment path. */
  async isEnabled(provider: string, capability: PaymentCapability): Promise<boolean> {
    if (!providerSupports(provider, capability)) return false;
    const override = (await this.loadOverrides()).get(key(provider, capability)) ?? null;
    return this.resolve(
      this.isConfigured(provider, capability),
      this.envDefault(provider, capability),
      override,
    );
  }

  /**
   * Single precedence rule, shared by isEnabled() and listStates() so they can
   * never disagree:  DB override → env default → "configured?".
   * Note: an explicit override/env `true` can enable an *unconfigured* provider
   * (e.g. a dev stub). The provider implementation is the real money guard — it
   * fails closed when credentials are missing — so this stays an availability
   * switch, not a security boundary.
   */
  private resolve(
    configured: boolean,
    envDefault: boolean | null,
    override: boolean | null,
  ): boolean {
    if (override !== null) return override;
    if (envDefault !== null) return envDefault;
    return configured;
  }

  /** Throw a clean 400 if a provider can't serve this capability right now. */
  async assertEnabled(provider: string, capability: PaymentCapability): Promise<void> {
    if (!getCatalogEntry(provider)) {
      throw new BadRequestException(`Unknown payment provider '${provider}'`);
    }
    if (!providerSupports(provider, capability)) {
      throw new BadRequestException(
        `Provider '${provider}' does not support ${capability}`,
      );
    }
    if (!(await this.isEnabled(provider, capability))) {
      throw new BadRequestException(
        `Provider '${provider}' is currently disabled for ${capability}`,
      );
    }
  }

  /** All providers enabled for a capability, in catalog order. */
  async enabledProviders(capability: PaymentCapability): Promise<string[]> {
    const states = await this.listStates(capability);
    return states.filter((s) => s.enabled).map((s) => s.provider);
  }

  /** Full resolved state for the admin console (optionally one capability). */
  async listStates(capability?: PaymentCapability): Promise<ResolvedProviderState[]> {
    const overrides = await this.loadOverrides();
    return allProviderCapabilities()
      .filter((pc) => !capability || pc.capability === capability)
      .map((pc) => {
        const configured = this.isConfigured(pc.provider, pc.capability);
        const envDefault = this.envDefault(pc.provider, pc.capability);
        const override = overrides.get(key(pc.provider, pc.capability)) ?? null;
        const enabled = this.resolve(configured, envDefault, override);
        return {
          provider: pc.provider,
          label: pc.label,
          capability: pc.capability,
          configured,
          envDefault,
          override,
          enabled,
        };
      });
  }

  /**
   * Admin write: set or clear the DB override. `enabled: null` removes the
   * override and reverts to the env default. Validates the pair exists.
   */
  async setOverride(
    provider: string,
    capability: PaymentCapability,
    enabled: boolean | null,
    actorId?: string,
    note?: string,
  ): Promise<ResolvedProviderState> {
    if (!providerSupports(provider, capability)) {
      throw new BadRequestException(
        `Provider '${provider}' does not support ${capability}`,
      );
    }
    await this.db.providerSetting.upsert({
      where: { provider_capability: { provider, capability } },
      create: { provider, capability, enabled, updatedBy: actorId, note },
      update: { enabled, updatedBy: actorId, note },
    });
    this.invalidate();
    this.logger.log(
      `Provider ${provider}/${capability} override set to ${enabled} by ${actorId ?? 'system'}`,
    );
    const state = (await this.listStates(capability)).find(
      (s) => s.provider === provider,
    );
    // Non-null: we just validated the pair exists in the catalog.
    return state!;
  }

  // ─── internals ─────────────────────────────────────────────────────────────

  private isConfigured(provider: string, capability: PaymentCapability): boolean {
    const cap = getCatalogEntry(provider)?.capabilities[capability];
    if (!cap) return false;
    const v = this.config.get<string>(cap.credentialEnv);
    return Boolean(v && v.trim());
  }

  private envDefault(provider: string, capability: PaymentCapability): boolean | null {
    const raw = this.config.get<string>(enabledEnvVar(provider, capability));
    if (raw === undefined || raw === null || raw.trim() === '') return null;
    const v = raw.trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes') return true;
    if (v === 'false' || v === '0' || v === 'no') return false;
    return null;
  }

  private async loadOverrides(): Promise<Map<string, boolean | null>> {
    const now = Date.now();
    if (this.overrideCache && now - this.overrideCacheAt < CACHE_TTL_MS) {
      return this.overrideCache;
    }
    const rows = await this.db.providerSetting.findMany();
    const map = new Map<string, boolean | null>();
    for (const r of rows) map.set(key(r.provider, r.capability), r.enabled);
    this.overrideCache = map;
    this.overrideCacheAt = now;
    return map;
  }

  private invalidate(): void {
    this.overrideCache = null;
    this.overrideCacheAt = 0;
  }
}

function key(provider: string, capability: string): string {
  return `${provider}:${capability}`;
}
