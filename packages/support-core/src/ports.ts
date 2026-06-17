// ---------------------------------------------------------------------------
// support-core — port interfaces
// Implement these in the consuming app (Prisma, Redis, etc.).
// ---------------------------------------------------------------------------

import type {
  SupporterProfile,
  CreateSupporterProfileInput,
  UpdateSupporterProfileInput,
  Subscription,
  SubscribeInput,
  SupporterGiftingSummary,
  SupporterListFilter,
  SubscriptionListFilter,
} from './types';

// ---------------------------------------------------------------------------
// Supporter profile store
// ---------------------------------------------------------------------------

export interface SupporterStorePort {
  findById(supporterId: string): Promise<SupporterProfile | undefined>;
  findByUserId(userId: string): Promise<SupporterProfile | undefined>;
  create(input: CreateSupporterProfileInput): Promise<SupporterProfile>;
  update(supporterId: string, input: UpdateSupporterProfileInput): Promise<SupporterProfile>;
  incrementSpend(supporterId: string, coins: number, fiatMinorUnits: number): Promise<SupporterProfile>;
  list(filter: SupporterListFilter): Promise<{ items: SupporterProfile[]; nextCursor?: string; hasMore: boolean }>;
}

// ---------------------------------------------------------------------------
// Subscription store
// ---------------------------------------------------------------------------

export interface SubscriptionStorePort {
  findById(subscriptionId: string): Promise<Subscription | undefined>;
  findActive(supporterId: string, starId: string): Promise<Subscription | undefined>;
  findByIdempotencyKey(key: string): Promise<Subscription | undefined>;
  create(sub: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<Subscription>;
  updateStatus(subscriptionId: string, status: Subscription['status'], patch?: Partial<Pick<Subscription, 'endsAt' | 'cancelledAt' | 'renewalEnabled'>>): Promise<Subscription>;
  list(filter: SubscriptionListFilter): Promise<{ items: Subscription[]; nextCursor?: string; hasMore: boolean }>;
  countActive(starId: string): Promise<number>;
}

// ---------------------------------------------------------------------------
// Gifting summary port (reads from tap-core persistence — injected optionally)
// ---------------------------------------------------------------------------

export interface SupporterGiftingSummaryPort {
  getSummary(supporterId: string, starId: string): Promise<SupporterGiftingSummary | undefined>;
  listTopSupporters(starId: string, limit: number): Promise<SupporterGiftingSummary[]>;
}

// ---------------------------------------------------------------------------
// Notification port (fire events on subscribe/unsubscribe)
// ---------------------------------------------------------------------------

export interface SupporterNotificationPort {
  onSubscribed(params: { supporterId: string; starId: string; tier: string }): Promise<void>;
  onCancelled(params: { supporterId: string; starId: string }): Promise<void>;
  onTierUpgraded(params: { supporterId: string; newTier: string }): Promise<void>;
}
