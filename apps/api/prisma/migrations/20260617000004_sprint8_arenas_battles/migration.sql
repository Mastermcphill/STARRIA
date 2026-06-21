-- Sprint 8: Arenas, Battles & Creator Leagues
-- Additive migration — no breaking changes.

-- ─── ENUMS ───────────────────────────────────────────────────────────────────

CREATE TYPE "BattleType" AS ENUM (
  'RAP_BATTLE',
  'SING_OFF',
  'COMEDY_CLASH',
  'YAP_BATTLE',
  'AI_FILM_BATTLE',
  'CREATOR_DUEL',
  'TEAM_BATTLE'
);

CREATE TYPE "BattleStatus" AS ENUM (
  'DRAFT',
  'REGISTRATION',
  'ACTIVE',
  'VOTING',
  'SETTLED',
  'ARCHIVED'
);

CREATE TYPE "VotingMethod" AS ENUM (
  'AUDIENCE',
  'SUPPORTER_WEIGHTED',
  'JUDGE',
  'HYBRID'
);

CREATE TYPE "ArenaDivision" AS ENUM (
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'DIAMOND',
  'LEGEND'
);

CREATE TYPE "ArenaSeasonStatus" AS ENUM (
  'UPCOMING',
  'ACTIVE',
  'ENDED'
);

CREATE TYPE "PrizePoolSource" AS ENUM (
  'TICKETS',
  'SPONSORSHIP',
  'CREATOR_DEPOSIT',
  'FAN_CONTRIBUTION'
);

CREATE TYPE "PrizeDistribution" AS ENUM (
  'WINNER_TAKES_ALL',
  'TOP_3_PAYOUT',
  'SPLIT_PAYOUT'
);

CREATE TYPE "BattleParticipantRole" AS ENUM (
  'CHALLENGER',
  'DEFENDER',
  'TEAM_MEMBER',
  'JUDGE'
);

CREATE TYPE "HouseBattleStatus" AS ENUM (
  'PENDING',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED'
);

-- ─── ARENA SEASON ─────────────────────────────────────────────────────────────

CREATE TABLE "ArenaSeason" (
  "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "name"        TEXT        NOT NULL,
  "number"      INTEGER     NOT NULL,
  "status"      "ArenaSeasonStatus" NOT NULL DEFAULT 'UPCOMING',
  "startsAt"    TIMESTAMP(3) NOT NULL,
  "endsAt"      TIMESTAMP(3) NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ArenaSeason_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArenaSeason_number_key" ON "ArenaSeason"("number");
CREATE INDEX "ArenaSeason_status_idx" ON "ArenaSeason"("status");

-- ─── CREATOR ELO ──────────────────────────────────────────────────────────────

CREATE TABLE "CreatorElo" (
  "id"              TEXT    NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "starProfileId"   TEXT    NOT NULL,
  "arenaSeasonId"   TEXT,
  "elo"             INTEGER NOT NULL DEFAULT 1200,
  "division"        "ArenaDivision" NOT NULL DEFAULT 'BRONZE',
  "wins"            INTEGER NOT NULL DEFAULT 0,
  "losses"          INTEGER NOT NULL DEFAULT 0,
  "draws"           INTEGER NOT NULL DEFAULT 0,
  "peakElo"         INTEGER NOT NULL DEFAULT 1200,
  "decayAppliedAt"  TIMESTAMP(3),
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CreatorElo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreatorElo_starProfile_season_key" ON "CreatorElo"("starProfileId", "arenaSeasonId");
CREATE INDEX "CreatorElo_division_elo_idx" ON "CreatorElo"("division", "elo" DESC);
CREATE INDEX "CreatorElo_arenaSeasonId_idx" ON "CreatorElo"("arenaSeasonId");

-- ─── BATTLE ───────────────────────────────────────────────────────────────────

CREATE TABLE "Battle" (
  "id"                TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "arenaId"           TEXT,
  "arenaSeasonId"     TEXT,
  "type"              "BattleType" NOT NULL,
  "status"            "BattleStatus" NOT NULL DEFAULT 'DRAFT',
  "votingMethod"      "VotingMethod" NOT NULL DEFAULT 'HYBRID',
  "title"             TEXT        NOT NULL,
  "description"       TEXT,
  "prizePoolId"       TEXT,
  "isTeamBattle"      BOOLEAN     NOT NULL DEFAULT FALSE,
  "maxParticipants"   INTEGER     NOT NULL DEFAULT 2,
  "registrationEndsAt" TIMESTAMP(3),
  "votingEndsAt"      TIMESTAMP(3),
  "scheduledAt"       TIMESTAMP(3),
  "startedAt"         TIMESTAMP(3),
  "endedAt"           TIMESTAMP(3),
  "winnerStarId"      TEXT,
  "winnerTeamId"      TEXT,
  "eloAwarded"        BOOLEAN     NOT NULL DEFAULT FALSE,
  "replayId"          TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Battle_arenaId_idx" ON "Battle"("arenaId");
CREATE INDEX "Battle_status_idx" ON "Battle"("status");
CREATE INDEX "Battle_type_status_idx" ON "Battle"("type", "status");
CREATE INDEX "Battle_arenaSeasonId_idx" ON "Battle"("arenaSeasonId");

-- ─── BATTLE PARTICIPANT ────────────────────────────────────────────────────────

CREATE TABLE "BattleParticipant" (
  "id"            TEXT    NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "battleId"      TEXT    NOT NULL,
  "starProfileId" TEXT    NOT NULL,
  "role"          "BattleParticipantRole" NOT NULL DEFAULT 'CHALLENGER',
  "teamId"        TEXT,
  "score"         INTEGER NOT NULL DEFAULT 0,
  "voteCount"     INTEGER NOT NULL DEFAULT 0,
  "joinedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BattleParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BattleParticipant_battle_star_key" ON "BattleParticipant"("battleId", "starProfileId");
CREATE INDEX "BattleParticipant_battleId_idx" ON "BattleParticipant"("battleId");

-- ─── BATTLE TEAM ──────────────────────────────────────────────────────────────

CREATE TABLE "BattleTeam" (
  "id"        TEXT    NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "battleId"  TEXT    NOT NULL,
  "name"      TEXT    NOT NULL,
  "side"      TEXT    NOT NULL DEFAULT 'A',
  "score"     INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BattleTeam_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BattleTeam_battleId_idx" ON "BattleTeam"("battleId");

-- ─── BATTLE VOTE ──────────────────────────────────────────────────────────────

CREATE TABLE "BattleVote" (
  "id"                TEXT    NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "battleId"          TEXT    NOT NULL,
  "voterId"           TEXT    NOT NULL,
  "targetParticipantId" TEXT  NOT NULL,
  "baseWeight"        FLOAT   NOT NULL DEFAULT 1.0,
  "trustScore"        FLOAT   NOT NULL DEFAULT 1.0,
  "patronMultiplier"  FLOAT   NOT NULL DEFAULT 1.0,
  "finalWeight"       FLOAT   NOT NULL DEFAULT 1.0,
  "isJudgeVote"       BOOLEAN NOT NULL DEFAULT FALSE,
  "fraudFlag"         BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BattleVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BattleVote_battle_voter_key" ON "BattleVote"("battleId", "voterId");
CREATE INDEX "BattleVote_battleId_idx" ON "BattleVote"("battleId");
CREATE INDEX "BattleVote_targetParticipantId_idx" ON "BattleVote"("targetParticipantId");
CREATE INDEX "BattleVote_fraudFlag_idx" ON "BattleVote"("fraudFlag");

-- ─── PRIZE POOL ───────────────────────────────────────────────────────────────

CREATE TABLE "ArenaPrizePool" (
  "id"              TEXT    NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "battleId"        TEXT,
  "totalCoins"      INTEGER NOT NULL DEFAULT 0,
  "distribution"    "PrizeDistribution" NOT NULL DEFAULT 'WINNER_TAKES_ALL',
  "escrowed"        BOOLEAN NOT NULL DEFAULT TRUE,
  "settled"         BOOLEAN NOT NULL DEFAULT FALSE,
  "settledAt"       TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ArenaPrizePool_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ArenaPrizePool_battleId_idx" ON "ArenaPrizePool"("battleId");
CREATE INDEX "ArenaPrizePool_settled_idx" ON "ArenaPrizePool"("settled");

-- ─── PRIZE POOL CONTRIBUTION ──────────────────────────────────────────────────

CREATE TABLE "PrizePoolContribution" (
  "id"            TEXT    NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "prizePoolId"   TEXT    NOT NULL,
  "contributorId" TEXT    NOT NULL,
  "source"        "PrizePoolSource" NOT NULL,
  "coins"         INTEGER NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PrizePoolContribution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrizePoolContribution_prizePoolId_idx" ON "PrizePoolContribution"("prizePoolId");

-- ─── HOUSE BATTLE ─────────────────────────────────────────────────────────────

CREATE TABLE "HouseBattle" (
  "id"              TEXT    NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "challengerHouseId" TEXT  NOT NULL,
  "defenderHouseId"   TEXT  NOT NULL,
  "battleId"          TEXT  NOT NULL,
  "status"            "HouseBattleStatus" NOT NULL DEFAULT 'PENDING',
  "winnerHouseId"     TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "HouseBattle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HouseBattle_challengerHouseId_idx" ON "HouseBattle"("challengerHouseId");
CREATE INDEX "HouseBattle_defenderHouseId_idx" ON "HouseBattle"("defenderHouseId");
CREATE INDEX "HouseBattle_status_idx" ON "HouseBattle"("status");

-- ─── BATTLE HIGHLIGHT ─────────────────────────────────────────────────────────

CREATE TABLE "BattleHighlight" (
  "id"          TEXT    NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "battleId"    TEXT    NOT NULL,
  "videoId"     TEXT,
  "title"       TEXT    NOT NULL,
  "clipUrl"     TEXT,
  "isWinnerClip" BOOLEAN NOT NULL DEFAULT FALSE,
  "isViralMoment" BOOLEAN NOT NULL DEFAULT FALSE,
  "pushedToDiscovery" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BattleHighlight_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BattleHighlight_battleId_idx" ON "BattleHighlight"("battleId");
CREATE INDEX "BattleHighlight_pushedToDiscovery_idx" ON "BattleHighlight"("pushedToDiscovery");
