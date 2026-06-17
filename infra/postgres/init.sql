-- STARRIA PostgreSQL initialisation
-- Extensions required by Prisma and the platform
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- full-text / trigram search

-- The schema itself is managed by Prisma migrations.
-- This file only sets up extensions that must exist before Prisma runs.
