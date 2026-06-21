// ---------------------------------------------------------------------------
// trust-core — TrustService
// Manages trust score calculation, flag handling, and restriction enforcement.
// Framework-agnostic.
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type { EventBus } from '@starria/domain-events';
import type {
  TrustProfile,
  TrustStorePort,
  UpdateSignalsInput,
  RaiseFlagInput,
  SetRestrictionInput,
  TrustEligibility,
  TrustSignals,
} from './types';
import {
  calculateTrustScore,
  resolveAutoRestrictions,
} from './types';
import {
  buildTrustScoreUpdated,
  buildTrustFlagRaised,
  buildTrustRestrictionSet,
} from './events';

const DEFAULT_SIGNALS: TrustSignals = {
  moderationScore:     100,
  fraudScore:          100,
  spamScore:           100,
  accountAgeDays:      0,
  conversationQuality: 100,
  creatorFeedback:     100,
  paymentDisputes:     0,
};

export class TrustService {
  constructor(
    private readonly store: TrustStorePort,
    private readonly eventBus?: EventBus,
  ) {}

  async getProfile(userId: string): Promise<TrustProfile> {
    const existing = await this.store.find(userId);
    if (existing) return existing;

    // Bootstrap a pristine profile for new users
    const score = calculateTrustScore(DEFAULT_SIGNALS);
    return this.store.upsert({
      userId,
      score,
      signals: DEFAULT_SIGNALS,
      restrictions: [],
      flags: [],
      updatedAt: new Date().toISOString(),
    });
  }

  async updateSignals(input: UpdateSignalsInput): Promise<TrustProfile> {
    const now = new Date().toISOString();
    const existing = await this.getProfile(input.userId);
    const previousScore = existing.score;

    const newSignals: TrustSignals = {
      ...existing.signals,
      ...input.signals,
    };

    const newScore = calculateTrustScore(newSignals);
    const autoRestrictions = resolveAutoRestrictions(newScore);

    // Merge auto-restrictions with any manually-set restrictions
    const manualRestrictions = existing.restrictions.filter(
      r => !resolveAutoRestrictions(existing.score).includes(r),
    );
    const mergedRestrictions = Array.from(new Set([...manualRestrictions, ...autoRestrictions]));

    const flags = await this.store.getFlags(input.userId);

    const profile = await this.store.upsert({
      userId: input.userId,
      score: newScore,
      signals: newSignals,
      restrictions: mergedRestrictions,
      flags,
      updatedAt: now,
    });

    void this.eventBus?.publish(buildTrustScoreUpdated({
      userId: input.userId,
      previousScore,
      newScore,
      signals: newSignals,
      updatedAt: now,
    }));

    // Emit restriction events for newly added auto-restrictions
    for (const restriction of autoRestrictions) {
      if (!existing.restrictions.includes(restriction)) {
        void this.eventBus?.publish(buildTrustRestrictionSet({
          userId: input.userId,
          restriction,
          reason: `Auto-applied: trust score dropped to ${newScore}`,
          setAt: now,
        }));
      }
    }

    return profile;
  }

  async raiseFlag(input: RaiseFlagInput): Promise<TrustProfile> {
    const now = new Date().toISOString();

    await this.store.appendFlag({
      userId: input.userId,
      flagType: input.flagType,
      raisedBy: input.raisedBy,
      raisedAt: now,
    });

    void this.eventBus?.publish(buildTrustFlagRaised({
      userId: input.userId,
      flagType: input.flagType,
      raisedBy: input.raisedBy,
      raisedAt: now,
    }));

    // Apply signal penalty based on flag type
    const current = await this.getProfile(input.userId);
    let penalty: Partial<TrustSignals>;
    switch (input.flagType) {
      case 'SPAM':
        penalty = { spamScore: Math.max(0, current.signals.spamScore - 20) };
        break;
      case 'FRAUD':
        penalty = { fraudScore: Math.max(0, current.signals.fraudScore - 30) };
        break;
      case 'ABUSE':
        penalty = { moderationScore: Math.max(0, current.signals.moderationScore - 25) };
        break;
      case 'PAYMENT_DISPUTE':
        penalty = { paymentDisputes: current.signals.paymentDisputes + 1 };
        break;
      default:
        penalty = {};
    }

    return this.updateSignals({ userId: input.userId, signals: penalty });
  }

  async setRestriction(input: SetRestrictionInput): Promise<TrustProfile> {
    const now = new Date().toISOString();
    const profile = await this.getProfile(input.userId);

    await this.store.appendRestriction({
      userId: input.userId,
      restriction: input.restriction,
      reason: input.reason,
      expiresAt: input.expiresAt,
      setAt: now,
    });

    const flags = await this.store.getFlags(input.userId);
    const updatedRestrictions = Array.from(new Set([...profile.restrictions, input.restriction]));

    const updated = await this.store.upsert({
      ...profile,
      restrictions: updatedRestrictions,
      flags,
      updatedAt: now,
    });

    void this.eventBus?.publish(buildTrustRestrictionSet({
      userId: input.userId,
      restriction: input.restriction,
      reason: input.reason,
      expiresAt: input.expiresAt,
      setAt: now,
    }));

    return updated;
  }

  async checkEligibility(userId: string): Promise<TrustEligibility> {
    const profile = await this.getProfile(userId);
    return {
      canMessage:          !profile.restrictions.includes('MESSAGING_BLOCKED'),
      canBePatron:         !profile.restrictions.includes('PATRON_INELIGIBLE'),
      isShadowRestricted:  profile.restrictions.includes('SHADOW_RESTRICTED'),
      score:               profile.score,
    };
  }
}
