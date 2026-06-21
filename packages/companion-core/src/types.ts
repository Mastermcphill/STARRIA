// ---------------------------------------------------------------------------
// companion-core — domain types
// Companion profiles, availability, rates, reviews, discovery
// ---------------------------------------------------------------------------

// ── Enumerations ──────────────────────────────────────────────────────────────

export type CompanionVerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export type CompanionStatus             = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'BANNED';

export type SessionActivity =
  | 'CHATTING'
  | 'DANCING'
  | 'MUSIC'
  | 'QA'
  | 'GAMING'
  | 'STORYTELLING'
  | 'ADVICE'
  | 'CREATOR_HANGOUT';

export type SessionTypeOffered = 'AUDIO' | 'VIDEO' | 'GROUP' | 'PRIVATE' | 'SUPPORTER_ONLY';

export type AvailabilitySlotDay =
  | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY'
  | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

// ── CompanionProfile ──────────────────────────────────────────────────────────

export interface CompanionProfile {
  readonly id: string;
  readonly userId: string;
  readonly displayName: string;
  readonly bio?: string;
  readonly nationality: string;
  readonly languages: string[];            // ISO 639-1 codes e.g. ['en', 'ja']
  readonly timezone: string;               // IANA timezone e.g. 'Asia/Tokyo'
  readonly heightCm?: number;
  readonly hobbies: string[];
  readonly interests: string[];
  readonly sessionTypes: SessionTypeOffered[];
  readonly activities: SessionActivity[];
  readonly verificationStatus: CompanionVerificationStatus;
  readonly verificationBadge: boolean;
  readonly ageVerified: boolean;
  readonly introVideoUrl?: string;
  readonly introImageUrls: string[];       // up to 6
  readonly status: CompanionStatus;
  readonly isAvailableNow: boolean;
  readonly averageRating: number;          // 0.0–5.0
  readonly reviewCount: number;
  readonly totalSessionMinutes: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ── CompanionRate ─────────────────────────────────────────────────────────────

export interface CompanionRate {
  readonly companionId: string;
  readonly sessionType: SessionTypeOffered;
  readonly durationMinutes: 15 | 30 | 45 | 60;
  readonly coinCost: number;
  readonly maxParticipants: number;        // 1 for PRIVATE, up to 50 for GROUP
  readonly isEnabled: boolean;
}

// ── CompanionAvailability ─────────────────────────────────────────────────────

export interface CompanionAvailabilitySlot {
  readonly id: string;
  readonly companionId: string;
  readonly day: AvailabilitySlotDay;
  readonly startHour: number;   // 0–23 UTC
  readonly endHour: number;     // 0–23 UTC
}

// ── CompanionReview ───────────────────────────────────────────────────────────

export interface CompanionReview {
  readonly id: string;
  readonly companionId: string;
  readonly reviewerId: string;
  readonly sessionId: string;
  readonly rating: number;       // 1–5
  readonly comment?: string;
  readonly isHidden: boolean;
  readonly createdAt: string;
}

// ── CompanionMedia ────────────────────────────────────────────────────────────

export type MediaType = 'IMAGE' | 'VIDEO' | 'INTRO_VIDEO';

export interface CompanionMedia {
  readonly id: string;
  readonly companionId: string;
  readonly type: MediaType;
  readonly url: string;
  readonly thumbnailUrl?: string;
  readonly isApproved: boolean;
  readonly sortOrder: number;
  readonly uploadedAt: string;
}

// ── Safety records ────────────────────────────────────────────────────────────

export interface CompanionBlock {
  readonly id: string;
  readonly blockerId: string;
  readonly blockedId: string;
  readonly blockedAt: string;
}

export interface CompanionReport {
  readonly id: string;
  readonly reporterId: string;
  readonly reportedId: string;
  readonly sessionId?: string;
  readonly reason: string;
  readonly status: 'PENDING' | 'REVIEWED' | 'ACTIONED' | 'DISMISSED';
  readonly reportedAt: string;
  readonly reviewedAt?: string;
}

// ── Discovery filter ──────────────────────────────────────────────────────────

export interface CompanionDiscoveryFilter {
  readonly sessionType?: SessionTypeOffered;
  readonly activity?: SessionActivity;
  readonly language?: string;
  readonly availableNow?: boolean;
  readonly maxCoinsPerSession?: number;
  readonly nationality?: string;
  readonly limit?: number;
  readonly offset?: number;
}

// ── Persistence port ──────────────────────────────────────────────────────────

export interface CompanionStorePort {
  create(input: Omit<CompanionProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<CompanionProfile>;
  findById(id: string): Promise<CompanionProfile | null>;
  findByUserId(userId: string): Promise<CompanionProfile | null>;
  update(id: string, patch: Partial<CompanionProfile>): Promise<CompanionProfile>;
  discover(filter: CompanionDiscoveryFilter): Promise<CompanionProfile[]>;

  upsertRate(rate: CompanionRate): Promise<CompanionRate>;
  getRates(companionId: string): Promise<CompanionRate[]>;
  getRate(companionId: string, sessionType: SessionTypeOffered, durationMinutes: number): Promise<CompanionRate | null>;

  upsertAvailabilitySlot(slot: Omit<CompanionAvailabilitySlot, 'id'>): Promise<CompanionAvailabilitySlot>;
  getAvailability(companionId: string): Promise<CompanionAvailabilitySlot[]>;

  createReview(review: Omit<CompanionReview, 'id'>): Promise<CompanionReview>;
  getReviews(companionId: string, limit?: number): Promise<CompanionReview[]>;

  createMedia(media: Omit<CompanionMedia, 'id'>): Promise<CompanionMedia>;
  getMedia(companionId: string): Promise<CompanionMedia[]>;

  createBlock(block: Omit<CompanionBlock, 'id'>): Promise<CompanionBlock>;
  isBlocked(blockerId: string, blockedId: string): Promise<boolean>;

  createReport(report: Omit<CompanionReport, 'id'>): Promise<CompanionReport>;
  getPendingReports(limit?: number): Promise<CompanionReport[]>;
}

// ── Service I/O ───────────────────────────────────────────────────────────────

export interface CreateCompanionInput {
  readonly userId: string;
  readonly displayName: string;
  readonly bio?: string;
  readonly nationality: string;
  readonly languages: string[];
  readonly timezone: string;
  readonly heightCm?: number;
  readonly hobbies?: string[];
  readonly interests?: string[];
  readonly sessionTypes: SessionTypeOffered[];
  readonly activities: SessionActivity[];
}

export interface UpdateCompanionInput {
  readonly companionId: string;
  readonly bio?: string;
  readonly languages?: string[];
  readonly hobbies?: string[];
  readonly interests?: string[];
  readonly heightCm?: number;
  readonly sessionTypes?: SessionTypeOffered[];
  readonly activities?: SessionActivity[];
  readonly introVideoUrl?: string;
}

export interface SetRatesInput {
  readonly companionId: string;
  readonly rates: Array<{
    sessionType: SessionTypeOffered;
    durationMinutes: 15 | 30 | 45 | 60;
    coinCost: number;
    maxParticipants: number;
  }>;
}

export interface LeaveReviewInput {
  readonly companionId: string;
  readonly reviewerId: string;
  readonly sessionId: string;
  readonly rating: number;
  readonly comment?: string;
}

export interface BlockCompanionInput {
  readonly blockerId: string;
  readonly blockedId: string;
}

export interface ReportCompanionInput {
  readonly reporterId: string;
  readonly reportedId: string;
  readonly sessionId?: string;
  readonly reason: string;
}
