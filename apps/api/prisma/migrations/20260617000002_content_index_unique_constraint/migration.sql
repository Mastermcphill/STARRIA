-- Migration: 20260617000002_content_index_unique_constraint
-- Adds a standalone unique index on ContentIndex.contentId.
--
-- The compound unique (contentType, contentId) has existed since the initial
-- schema, but the search layer also needs a direct lookup by contentId alone
-- to resolve a single canonical index entry per content object regardless of
-- type.  This makes ContentIndex.contentId a proper foreign-key target.

CREATE UNIQUE INDEX "ContentIndex_contentId_key" ON "ContentIndex"("contentId");
