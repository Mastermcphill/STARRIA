# ─────────────────────────────────────────────────────────────────────────────
# Base — pnpm + Prisma engine prerequisites (openssl/libc for alpine)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache openssl libc6-compat
RUN npm install -g pnpm@9
WORKDIR /app

# ─────────────────────────────────────────────────────────────────────────────
# deps — install the full workspace. ALL workspace manifests must be present
# before `pnpm install` so every workspace:* dependency of apps/api resolves.
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/

# Every package manifest (keeps the workspace graph complete for the lockfile)
COPY packages/domain-events/package.json    ./packages/domain-events/
COPY packages/geo-core/package.json         ./packages/geo-core/
COPY packages/wallet-core/package.json      ./packages/wallet-core/
COPY packages/gifting-core/package.json     ./packages/gifting-core/
COPY packages/feed-core/package.json        ./packages/feed-core/
COPY packages/notification-core/package.json ./packages/notification-core/
COPY packages/moderation-core/package.json  ./packages/moderation-core/
COPY packages/analytics-core/package.json   ./packages/analytics-core/
COPY packages/video-core/package.json       ./packages/video-core/
COPY packages/search-core/package.json      ./packages/search-core/
COPY packages/discovery-core/package.json   ./packages/discovery-core/
COPY packages/support-core/package.json     ./packages/support-core/
COPY packages/star-core/package.json        ./packages/star-core/
COPY packages/tap-core/package.json         ./packages/tap-core/
COPY packages/event-core/package.json       ./packages/event-core/
COPY packages/arena-core/package.json       ./packages/arena-core/
COPY packages/creator-os-core/package.json  ./packages/creator-os-core/

RUN pnpm install --frozen-lockfile

# ─────────────────────────────────────────────────────────────────────────────
# build — compile workspace packages first (turbo ^build), then apps/api,
# then generate the Prisma client.
# ─────────────────────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
# Generate the Prisma client FIRST — apps/api's source imports model types from
# '@prisma/client', so they must exist before the TypeScript build runs.
RUN pnpm --filter @starria/api db:generate
# turbo's `build` task declares dependsOn: ["^build"], so filtering to the API
# builds every workspace package it depends on first, in dependency order.
RUN pnpm exec turbo run build --filter=@starria/api

# ─────────────────────────────────────────────────────────────────────────────
# runner — production image. Carries the built workspace packages + the pnpm
# store so every @starria/* symlink target and the generated Prisma client are
# present (no dangling symlinks → no MODULE_NOT_FOUND at runtime).
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl libc6-compat
ENV NODE_ENV=production
WORKDIR /app

# Workspace topology (needed so relative @starria/* symlinks resolve)
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
# pnpm virtual store + hoisted deps (includes the generated Prisma client + bins)
COPY --from=build /app/node_modules ./node_modules
# Built workspace packages — the symlink targets for @starria/* (dist + manifests)
COPY --from=build /app/packages ./packages
# The API app: its local node_modules (links/bins), compiled output, prisma schema, manifest
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/package.json ./apps/api/package.json

WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
