// ---------------------------------------------------------------------------
// star-core — types
// Defines the Star (creator) identity, tier system, verification contract,
// and discoverability model for the STARRIA platform.
// No NestJS / Prisma dependencies.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Star profile
// ---------------------------------------------------------------------------

export type StarTier = 'rising' | 'verified' | 'elite';

export type StarStatus = 'pending' | 'active' | 'suspended' | 'deactivated';

export interface StarProfile {
  readonly id: string;
  readonly userId: string;
  readonly displayName: string;
  readonly username: string;
  readonly avatarUrl?: string;
  readonly coverUrl?: string;
  readonly bio?: string;
  readonly category: string;
  readonly tags: string[];
  readonly tier: StarTier;
  readonly status: StarStatus;
  readonly isVerified: boolean;
  readonly verifiedAt?: string;
  /** Platform-assigned weight used in discovery ranking. */
  readonly discoveryScore: number;
  readonly followerCount: number;
  readonly subscriberCount: number;
  readonly totalEventsHosted: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateStarProfileInput {
  readonly userId: string;
  readonly displayName: string;
  readonly username: string;
  readonly avatarUrl?: string;
  readonly bio?: string;
  readonly category: string;
  readonly tags?: string[];
}

export interface UpdateStarProfileInput {
  readonly displayName?: string;
  readonly avatarUrl?: string;
  readonly coverUrl?: string;
  readonly bio?: string;
  readonly category?: string;
  readonly tags?: string[];
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'revoked';

export interface StarVerificationRequest {
  readonly id: string;
  readonly starId: string;
  readonly status: VerificationStatus;
  readonly submittedAt: string;
  readonly reviewedAt?: string;
  readonly reviewedBy?: string;
  readonly rejectionReason?: string;
  readonly documents: StarVerificationDocument[];
}

export interface StarVerificationDocument {
  readonly type: 'id_card' | 'selfie' | 'social_proof' | 'other';
  readonly mediaUploadId: string;
  readonly submittedAt: string;
}

export interface SubmitVerificationInput {
  readonly starId: string;
  readonly documents: Array<Omit<StarVerificationDocument, 'submittedAt'>>;
}

// ---------------------------------------------------------------------------
// Tier progression
// ---------------------------------------------------------------------------

export interface StarTierConfig {
  readonly tier: StarTier;
  readonly subscriberThreshold: number;
  readonly label: string;
  readonly badge: string;
  readonly perks: string[];
}

export const DEFAULT_STAR_TIER_CONFIG: readonly StarTierConfig[] = [
  { tier: 'rising',   subscriberThreshold: 0,    label: 'Rising',   badge: '⭐',  perks: ['create_events'] },
  { tier: 'verified', subscriberThreshold: 100,  label: 'Verified', badge: '✅⭐', perks: ['create_events', 'verification_badge', 'analytics_dashboard'] },
  { tier: 'elite',    subscriberThreshold: 5000, label: 'Elite',    badge: '💫',  perks: ['create_events', 'verification_badge', 'analytics_dashboard', 'priority_support', 'revenue_boost'] },
];

export function computeStarTier(
  subscriberCount: number,
  config: readonly StarTierConfig[] = DEFAULT_STAR_TIER_CONFIG,
): StarTier {
  const sorted = [...config].sort((a, b) => b.subscriberThreshold - a.subscriberThreshold);
  for (const c of sorted) {
    if (subscriberCount >= c.subscriberThreshold) return c.tier;
  }
  return 'rising';
}

// ---------------------------------------------------------------------------
// Discovery / search
// ---------------------------------------------------------------------------

export interface StarDiscoveryFilter {
  category?: string;
  tags?: string[];
  tier?: StarTier;
  isVerified?: boolean;
  query?: string;
  cursor?: string;
  limit?: number;
}

export interface StarDiscoveryResult {
  readonly id: string;
  readonly displayName: string;
  readonly username: string;
  readonly avatarUrl?: string;
  readonly category: string;
  readonly tier: StarTier;
  readonly isVerified: boolean;
  readonly discoveryScore: number;
  readonly subscriberCount: number;
  readonly isLive: boolean;
}

// ---------------------------------------------------------------------------
// Follow
// ---------------------------------------------------------------------------

export interface StarFollow {
  readonly id: string;
  readonly followerId: string;
  readonly starId: string;
  readonly createdAt: string;
}
