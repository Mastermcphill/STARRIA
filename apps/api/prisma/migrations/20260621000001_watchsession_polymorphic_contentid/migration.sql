-- WatchSession.contentId is polymorphic (event | replay | live_room). The FK to
-- Event rejected live_room rows (whose contentId is a LiveRoom id, not an Event
-- id), so live participant persistence failed against a real database. Drop the
-- constraint; contentId is now a plain polymorphic column keyed by contentType.
ALTER TABLE "WatchSession" DROP CONSTRAINT IF EXISTS "WatchSession_contentId_fkey";
