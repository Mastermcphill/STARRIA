# STARRIA

Creator-economy platform where **Stars** host live **Arenas**, receive **Taps** from **Supporters**, and produce content with **AI Creator Tools**.

## Monorepo structure

```
STARRIA/
├── apps/
│   ├── api/          NestJS + Fastify API
│   └── mobile/       Flutter mobile app
├── packages/
│   ├── wallet-core/         Ledger, balances, hash-chain  (TS — from LifeNest)
│   ├── gifting-core/        Coin gifts, fiat tips          (TS — from LifeNest)
│   ├── feed-core/           FYP engine, infinite scroll    (TS — from LifeNest)
│   ├── notification-core/   In-app, push, email, SMS       (TS — from LifeNest)
│   ├── moderation-core/     Reports, queues, blocking      (TS — from LifeNest)
│   ├── analytics-core/      Watch sessions, retention      (TS — from LifeNest)
│   ├── video-core/          Upload, streaming, HLS stubs   (Python — from Vidzi)
│   └── search-core/         Content index, recommendations (Python — from Vidzi)
├── infra/
│   ├── postgres/     Init SQL (uuid-ossp, pgcrypto, pg_trgm)
│   └── redis/        Redis config
└── docs/
    ├── architecture/ System design, API contracts, migration roadmap, MVP plan
    ├── lifenest-extraction/
    └── vidzi-extraction/
```

## Quick start

```bash
# 1. Install deps
pnpm install

# 2. Copy env
cp .env.example .env

# 3. Boot infra
docker compose up -d postgres redis

# 4. Apply migrations
pnpm db:migrate

# 5. Start API in dev mode
pnpm dev --filter @starria/api

# 6. Run Flutter app
cd apps/mobile && flutter run
```

## Architecture docs

| Doc | Contents |
|---|---|
| [01 System Architecture](docs/architecture/01-system-architecture.md) | Layer diagram, data flows |
| [02 Dependency Graph](docs/architecture/02-dependency-graph.md) | Package inter-deps |
| [03 Package Relationships](docs/architecture/03-package-relationships.md) | Port pattern, pipelines |
| [04 API Contracts](docs/architecture/04-api-contracts.md) | All endpoints, shapes |
| [05 Migration Roadmap](docs/architecture/05-migration-roadmap.md) | Phases, DB backfills |
| [06 MVP Plan](docs/architecture/06-mvp-implementation-plan.md) | 7-sprint plan, DoD |

## Extraction sources

- **LifeNest** → `docs/lifenest-extraction/` — TypeScript packages
- **Vidzi** → `docs/vidzi-extraction/` — Python packages
