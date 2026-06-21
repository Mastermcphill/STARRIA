-- Migration: 20260617000003_sprint3_event_enums
-- Sprint 3 — Live Experience.
-- Adds DRAFT / PUBLISHED to EventStatus and 7 new EventType variants
-- for the Live Experience economy (comedy shows, rap battles, etc.).

-- ── EventStatus: add DRAFT and PUBLISHED ──────────────────────────────────────

ALTER TYPE "EventStatus" ADD VALUE IF NOT EXISTS 'DRAFT'     BEFORE 'SCHEDULED';
ALTER TYPE "EventStatus" ADD VALUE IF NOT EXISTS 'PUBLISHED' BEFORE 'SCHEDULED';

-- ── EventType: add Sprint 3 show categories ───────────────────────────────────

ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'COMEDY_SHOW';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'AI_PREMIERE';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'RAP_BATTLE';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'SING_OFF';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'CREATOR_QA';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'YAP_BATTLE';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'SUPPORTER_ROOM';
