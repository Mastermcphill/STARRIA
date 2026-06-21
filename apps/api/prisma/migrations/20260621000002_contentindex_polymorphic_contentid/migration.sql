-- ContentIndex.contentId is polymorphic (event | replay | live_room). The FK to
-- Event rejected replay/live_room rows (whose contentId is not an Event id), so
-- indexing non-event content failed against a real database. Drop the
-- constraint; contentId is now a plain polymorphic column keyed by contentType.
ALTER TABLE "ContentIndex" DROP CONSTRAINT IF EXISTS "ContentIndex_contentId_fkey";
