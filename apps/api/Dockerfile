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

# Copy EVERY workspace package manifest so the pnpm workspace graph is complete
# before install. The previous hand-maintained per-package list silently dropped
# 13 packages (companion, messaging, patron, trust, ticketing, live, age-gate,
# campaign, star, session-engine, session, voting, ranking) and broke
# `pnpm install --frozen-lockfile`. Copying the whole packages/ tree is resilient
# to new packages being added without editing the Dockerfile (Sprint 9 fix).
COPY packages/ ./packages/

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

# Image-level health check (compose also defines one). Hits the liveness probe;
# alpine has no curl, so use a tiny inline Node HTTP request.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3000)+'/'+(process.env.API_PREFIX||'api/v1')+'/health/live',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/main.js"]
