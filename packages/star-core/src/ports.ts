// ---------------------------------------------------------------------------
// star-core — port interfaces
// ---------------------------------------------------------------------------

import type {
  StarProfile,
  CreateStarProfileInput,
  UpdateStarProfileInput,
  StarDiscoveryFilter,
  StarDiscoveryResult,
  StarVerificationRequest,
  SubmitVerificationInput,
  StarFollow,
} from './types';

// ---------------------------------------------------------------------------
// Star profile store
// ---------------------------------------------------------------------------

export interface StarStorePort {
  findById(starId: string): Promise<StarProfile | undefined>;
  findByUserId(userId: string): Promise<StarProfile | undefined>;
  findByUsername(username: string): Promise<StarProfile | undefined>;
  create(input: CreateStarProfileInput): Promise<StarProfile>;
  update(starId: string, input: UpdateStarProfileInput): Promise<StarProfile>;
  updateTier(starId: string, tier: StarProfile['tier']): Promise<StarProfile>;
  updateDiscoveryScore(starId: string, score: number): Promise<StarProfile>;
  incrementFollowers(starId: string, delta: number): Promise<void>;
  incrementSubscribers(starId: string, delta: number): Promise<void>;
  incrementEventsHosted(starId: string): Promise<void>;
  updateLiveStatus(starId: string, isLive: boolean): Promise<void>;
}

// ---------------------------------------------------------------------------
// Discovery port
// ---------------------------------------------------------------------------

export interface StarDiscoveryPort {
  search(filter: StarDiscoveryFilter): Promise<{ items: StarDiscoveryResult[]; nextCursor?: string; hasMore: boolean }>;
  listByCategory(category: string, limit: number, cursor?: string): Promise<{ items: StarDiscoveryResult[]; nextCursor?: string; hasMore: boolean }>;
  listTrending(limit: number): Promise<StarDiscoveryResult[]>;
  listLive(limit: number): Promise<StarDiscoveryResult[]>;
}

// ---------------------------------------------------------------------------
// Verification store
// ---------------------------------------------------------------------------

export interface StarVerificationStorePort {
  findPending(starId: string): Promise<StarVerificationRequest | undefined>;
  create(input: SubmitVerificationInput): Promise<StarVerificationRequest>;
  updateStatus(requestId: string, status: StarVerificationRequest['status'], patch?: Partial<Pick<StarVerificationRequest, 'reviewedAt' | 'reviewedBy' | 'rejectionReason'>>): Promise<StarVerificationRequest>;
}

// ---------------------------------------------------------------------------
// Follow store
// ---------------------------------------------------------------------------

export interface StarFollowPort {
  follow(followerId: string, starId: string): Promise<StarFollow>;
  unfollow(followerId: string, starId: string): Promise<void>;
  isFollowing(followerId: string, starId: string): Promise<boolean>;
  listFollowers(starId: string, limit: number, cursor?: string): Promise<{ items: StarFollow[]; nextCursor?: string; hasMore: boolean }>;
  listFollowing(followerId: string, limit: number, cursor?: string): Promise<{ items: StarFollow[]; nextCursor?: string; hasMore: boolean }>;
}

// ---------------------------------------------------------------------------
// Notification port
// ---------------------------------------------------------------------------

export interface StarNotificationPort {
  onVerificationApproved(starId: string): Promise<void>;
  onVerificationRejected(starId: string, reason: string): Promise<void>;
  onTierUpgraded(starId: string, newTier: string): Promise<void>;
  onNewFollower(starId: string, followerId: string): Promise<void>;
  onNewSubscriber(starId: string, supporterId: string, tier: string): Promise<void>;
}
