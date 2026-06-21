-- Sprint 10 — domain persistence (additive: 43 new tables, no changes to existing tables)
-- Replaces in-memory repositories for campaign, companion, patron, trust,
-- session-engine, replay, prestige (star-core), and creator-os domains.

-- CreateTable
CREATE TABLE "VisibilityCampaign" (
    "id" TEXT NOT NULL,
    "starId" TEXT NOT NULL,
    "promotableType" TEXT NOT NULL,
    "promotableId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "coinsSpent" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisibilityCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignLedgerEntry" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "starId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "coinsAmount" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignAnalytics" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanionProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "nationality" TEXT NOT NULL,
    "languages" TEXT[],
    "timezone" TEXT NOT NULL,
    "heightCm" INTEGER,
    "hobbies" TEXT[],
    "interests" TEXT[],
    "sessionTypes" TEXT[],
    "activities" TEXT[],
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "verificationBadge" BOOLEAN NOT NULL DEFAULT false,
    "ageVerified" BOOLEAN NOT NULL DEFAULT false,
    "introVideoUrl" TEXT,
    "introImageUrls" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isAvailableNow" BOOLEAN NOT NULL DEFAULT false,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "totalSessionMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanionRate" (
    "companionId" TEXT NOT NULL,
    "sessionType" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "coinCost" INTEGER NOT NULL,
    "maxParticipants" INTEGER NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CompanionRate_pkey" PRIMARY KEY ("companionId","sessionType","durationMinutes")
);

-- CreateTable
CREATE TABLE "CompanionAvailabilitySlot" (
    "id" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "startHour" INTEGER NOT NULL,
    "endHour" INTEGER NOT NULL,

    CONSTRAINT "CompanionAvailabilitySlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanionReview" (
    "id" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanionReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanionMedia" (
    "id" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanionMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanionBlock" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "blockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanionBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanionReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedId" TEXT NOT NULL,
    "sessionId" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "CompanionReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LonelinessProfile" (
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "signals" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LonelinessProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AgeGateProfile" (
    "userId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_VERIFIED',
    "verificationMethod" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "safeModeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgeGateProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentType" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionBooking" (
    "id" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "patronId" TEXT NOT NULL,
    "sessionType" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "coinCost" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionEscrow" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "patronId" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "heldCoins" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'HELD',
    "heldAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "SessionEscrow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionReservation" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "sessionType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "livekitRoomName" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "extensionMinutes" INTEGER NOT NULL DEFAULT 0,
    "participantCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionExtension" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "patronId" TEXT NOT NULL,
    "addedMinutes" INTEGER NOT NULL,
    "additionalCoins" INTEGER NOT NULL,
    "escrowId" TEXT NOT NULL,
    "extendedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionExtension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanionSessionParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "livekitIdentity" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL,
    "leftAt" TIMESTAMP(3),
    "watchSeconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CompanionSessionParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionPayout" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "grossCoins" INTEGER NOT NULL,
    "platformFeeCoins" INTEGER NOT NULL,
    "netCoins" INTEGER NOT NULL,
    "splits" JSONB NOT NULL,
    "settledAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatronProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'VISITOR',
    "lifetimeUsdCents" INTEGER NOT NULL DEFAULT 0,
    "lifetimeCoins" INTEGER NOT NULL DEFAULT 0,
    "supportDiversity" INTEGER NOT NULL DEFAULT 0,
    "accountAgeDays" INTEGER NOT NULL DEFAULT 0,
    "moderationStrikes" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatronProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatronHistory" (
    "id" TEXT NOT NULL,
    "patronId" TEXT NOT NULL,
    "starId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "coinsAmount" INTEGER NOT NULL,
    "usdCents" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatronHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorRelationship" (
    "id" TEXT NOT NULL,
    "patronId" TEXT NOT NULL,
    "starId" TEXT NOT NULL,
    "creatorLifetimeUsdCents" INTEGER NOT NULL DEFAULT 0,
    "creatorLifetimeCoins" INTEGER NOT NULL DEFAULT 0,
    "creatorTier" TEXT NOT NULL DEFAULT 'VISITOR',
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "rank" INTEGER,
    "firstSupportedAt" TIMESTAMP(3) NOT NULL,
    "lastSupportedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatronAchievement" (
    "id" TEXT NOT NULL,
    "patronId" TEXT NOT NULL,
    "achievementType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "badge" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatronAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatronMilestone" (
    "id" TEXT NOT NULL,
    "patronId" TEXT NOT NULL,
    "starId" TEXT NOT NULL,
    "milestoneType" TEXT NOT NULL,
    "thresholdUsdCents" INTEGER NOT NULL,
    "reachedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatronMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustProfile" (
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "signals" JSONB NOT NULL,
    "restrictions" TEXT[],
    "flags" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "TrustFlag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "flagType" TEXT NOT NULL,
    "raisedBy" TEXT NOT NULL,
    "raisedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustRestrictionRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restriction" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "setAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustRestrictionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionRoom" (
    "id" TEXT NOT NULL,
    "roomType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "maxParticipants" INTEGER NOT NULL,
    "livekitRoomName" TEXT NOT NULL,
    "billing" JSONB NOT NULL,
    "permissions" JSONB NOT NULL,
    "recordingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "replayPublishing" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "openedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "SessionRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionRoomParticipant" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "invitedBy" TEXT,
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "SessionRoomParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionRecording" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IDLE',
    "egressId" TEXT,
    "rawAssetUrl" TEXT,
    "durationSeconds" INTEGER,
    "startedAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),

    CONSTRAINT "SessionRecording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionModeration" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionModeration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Replay" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "sourceRoomType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "rawAssetUrl" TEXT,
    "playbackUrl" TEXT,
    "posterUrl" TEXT,
    "thumbnailUrls" TEXT[],
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "priceCoins" INTEGER,
    "minSubscriberTier" TEXT,
    "title" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "pushedToDiscovery" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Replay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhiteStarProfile" (
    "id" TEXT NOT NULL,
    "starId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "halfStars" INTEGER NOT NULL DEFAULT 1,
    "tierLabel" TEXT NOT NULL,
    "factors" JSONB NOT NULL,
    "uploadUsedThisWeek" INTEGER NOT NULL DEFAULT 0,
    "weekResetAt" TIMESTAMP(3) NOT NULL,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhiteStarProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhiteStarHistory" (
    "id" TEXT NOT NULL,
    "starId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "halfStars" INTEGER NOT NULL,
    "tierLabel" TEXT NOT NULL,
    "factors" JSONB NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhiteStarHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StarDecay" (
    "id" TEXT NOT NULL,
    "starId" TEXT NOT NULL,
    "decayAmount" INTEGER NOT NULL,
    "scoreBefore" INTEGER NOT NULL,
    "scoreAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StarDecay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhiteStarSeasonScore" (
    "id" TEXT NOT NULL,
    "starId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "seasonName" TEXT NOT NULL,
    "finalScore" INTEGER NOT NULL,
    "finalHalfStars" INTEGER NOT NULL,
    "finalTierLabel" TEXT NOT NULL,
    "rank" INTEGER,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhiteStarSeasonScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoldStarPrestigeProfile" (
    "id" TEXT NOT NULL,
    "starId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "tierLabel" TEXT NOT NULL,
    "accountAgeMonths" INTEGER NOT NULL DEFAULT 0,
    "supporterRetentionPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "countryReach" INTEGER NOT NULL DEFAULT 0,
    "moderationIncidents" INTEGER NOT NULL DEFAULT 0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoldStarPrestigeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoldStarAchievement" (
    "id" TEXT NOT NULL,
    "starId" TEXT NOT NULL,
    "achievementType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconUrl" TEXT,
    "unlockedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoldStarAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorReputation" (
    "id" TEXT NOT NULL,
    "starId" TEXT NOT NULL,
    "whiteStarScore" INTEGER NOT NULL DEFAULT 0,
    "goldStarScore" INTEGER NOT NULL DEFAULT 0,
    "combinedScore" INTEGER NOT NULL DEFAULT 0,
    "platformFeePct" INTEGER NOT NULL DEFAULT 0,
    "weeklyUploadCap" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorReputation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorCalendarEntry" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "metadata" JSONB,

    CONSTRAINT "CreatorCalendarEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorCommerceItem" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "roomId" TEXT,
    "itemType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "priceCoins" INTEGER NOT NULL,
    "inventory" INTEGER,
    "sold" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "listedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorCommerceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorCommercePurchase" (
    "idempotencyKey" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorCommercePurchase_pkey" PRIMARY KEY ("idempotencyKey")
);

-- CreateTable
CREATE TABLE "CreatorClip" (
    "id" TEXT NOT NULL,
    "sourceReplayId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "lengthSeconds" INTEGER NOT NULL,
    "startOffsetSeconds" INTEGER NOT NULL,
    "clipUrl" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorClip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisibilityCampaign_idempotencyKey_key" ON "VisibilityCampaign"("idempotencyKey");

-- CreateIndex
CREATE INDEX "VisibilityCampaign_starId_idx" ON "VisibilityCampaign"("starId");

-- CreateIndex
CREATE INDEX "VisibilityCampaign_status_idx" ON "VisibilityCampaign"("status");

-- CreateIndex
CREATE INDEX "VisibilityCampaign_scope_status_idx" ON "VisibilityCampaign"("scope", "status");

-- CreateIndex
CREATE INDEX "CampaignLedgerEntry_campaignId_idx" ON "CampaignLedgerEntry"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignAnalytics_campaignId_key" ON "CampaignAnalytics"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanionProfile_userId_key" ON "CompanionProfile"("userId");

-- CreateIndex
CREATE INDEX "CompanionProfile_status_idx" ON "CompanionProfile"("status");

-- CreateIndex
CREATE INDEX "CompanionProfile_isAvailableNow_idx" ON "CompanionProfile"("isAvailableNow");

-- CreateIndex
CREATE INDEX "CompanionRate_companionId_idx" ON "CompanionRate"("companionId");

-- CreateIndex
CREATE INDEX "CompanionAvailabilitySlot_companionId_idx" ON "CompanionAvailabilitySlot"("companionId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanionAvailabilitySlot_companionId_day_startHour_key" ON "CompanionAvailabilitySlot"("companionId", "day", "startHour");

-- CreateIndex
CREATE INDEX "CompanionReview_companionId_idx" ON "CompanionReview"("companionId");

-- CreateIndex
CREATE INDEX "CompanionMedia_companionId_idx" ON "CompanionMedia"("companionId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanionBlock_blockerId_blockedId_key" ON "CompanionBlock"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "CompanionReport_status_idx" ON "CompanionReport"("status");

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_idx" ON "ConsentRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionBooking_idempotencyKey_key" ON "SessionBooking"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SessionBooking_companionId_idx" ON "SessionBooking"("companionId");

-- CreateIndex
CREATE INDEX "SessionBooking_patronId_idx" ON "SessionBooking"("patronId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionEscrow_bookingId_key" ON "SessionEscrow"("bookingId");

-- CreateIndex
CREATE INDEX "SessionReservation_bookingId_idx" ON "SessionReservation"("bookingId");

-- CreateIndex
CREATE INDEX "SessionReservation_companionId_idx" ON "SessionReservation"("companionId");

-- CreateIndex
CREATE INDEX "SessionExtension_sessionId_idx" ON "SessionExtension"("sessionId");

-- CreateIndex
CREATE INDEX "CompanionSessionParticipant_sessionId_idx" ON "CompanionSessionParticipant"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionPayout_sessionId_key" ON "SessionPayout"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PatronProfile_userId_key" ON "PatronProfile"("userId");

-- CreateIndex
CREATE INDEX "PatronHistory_patronId_idx" ON "PatronHistory"("patronId");

-- CreateIndex
CREATE INDEX "CreatorRelationship_starId_idx" ON "CreatorRelationship"("starId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorRelationship_patronId_starId_key" ON "CreatorRelationship"("patronId", "starId");

-- CreateIndex
CREATE INDEX "PatronAchievement_patronId_idx" ON "PatronAchievement"("patronId");

-- CreateIndex
CREATE INDEX "PatronMilestone_patronId_idx" ON "PatronMilestone"("patronId");

-- CreateIndex
CREATE INDEX "TrustFlag_userId_idx" ON "TrustFlag"("userId");

-- CreateIndex
CREATE INDEX "TrustRestrictionRecord_userId_idx" ON "TrustRestrictionRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionRoom_idempotencyKey_key" ON "SessionRoom"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SessionRoom_status_idx" ON "SessionRoom"("status");

-- CreateIndex
CREATE INDEX "SessionRoom_roomType_idx" ON "SessionRoom"("roomType");

-- CreateIndex
CREATE INDEX "SessionRoomParticipant_roomId_idx" ON "SessionRoomParticipant"("roomId");

-- CreateIndex
CREATE INDEX "SessionRoomParticipant_roomId_userId_idx" ON "SessionRoomParticipant"("roomId", "userId");

-- CreateIndex
CREATE INDEX "SessionRecording_roomId_idx" ON "SessionRecording"("roomId");

-- CreateIndex
CREATE INDEX "SessionModeration_roomId_idx" ON "SessionModeration"("roomId");

-- CreateIndex
CREATE INDEX "Replay_recordingId_idx" ON "Replay"("recordingId");

-- CreateIndex
CREATE INDEX "Replay_creatorId_idx" ON "Replay"("creatorId");

-- CreateIndex
CREATE INDEX "Replay_pushedToDiscovery_visibility_idx" ON "Replay"("pushedToDiscovery", "visibility");

-- CreateIndex
CREATE UNIQUE INDEX "WhiteStarProfile_starId_key" ON "WhiteStarProfile"("starId");

-- CreateIndex
CREATE INDEX "WhiteStarProfile_score_idx" ON "WhiteStarProfile"("score");

-- CreateIndex
CREATE INDEX "WhiteStarHistory_starId_idx" ON "WhiteStarHistory"("starId");

-- CreateIndex
CREATE INDEX "StarDecay_starId_idx" ON "StarDecay"("starId");

-- CreateIndex
CREATE INDEX "WhiteStarSeasonScore_starId_idx" ON "WhiteStarSeasonScore"("starId");

-- CreateIndex
CREATE UNIQUE INDEX "GoldStarPrestigeProfile_starId_key" ON "GoldStarPrestigeProfile"("starId");

-- CreateIndex
CREATE INDEX "GoldStarPrestigeProfile_score_idx" ON "GoldStarPrestigeProfile"("score");

-- CreateIndex
CREATE INDEX "GoldStarAchievement_starId_idx" ON "GoldStarAchievement"("starId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorReputation_starId_key" ON "CreatorReputation"("starId");

-- CreateIndex
CREATE INDEX "CreatorCalendarEntry_creatorId_idx" ON "CreatorCalendarEntry"("creatorId");

-- CreateIndex
CREATE INDEX "CreatorCommerceItem_creatorId_idx" ON "CreatorCommerceItem"("creatorId");

-- CreateIndex
CREATE INDEX "CreatorCommerceItem_roomId_idx" ON "CreatorCommerceItem"("roomId");

-- CreateIndex
CREATE INDEX "CreatorCommercePurchase_itemId_idx" ON "CreatorCommercePurchase"("itemId");

-- CreateIndex
CREATE INDEX "CreatorClip_sourceReplayId_idx" ON "CreatorClip"("sourceReplayId");
