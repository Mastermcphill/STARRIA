# Database Migrations — STARRIA

All schema changes are managed as SQL migration files under
`apps/api/prisma/migrations/`. Prisma tracks applied migrations in the
`_prisma_migrations` table.

---

## Migration history

| File | Contents |
|------|----------|
| `20260615000000_initial_schema` | All base tables: User, StarProfile, SupporterProfile, Subscription, Arena, Event, Tap, Wallet, WalletEntry, Notification, ModerationReport, WatchSession, FeedEngagement, MediaUpload, ContentIndex, RecommendationFeedback, AiCreatorProfile, AiGeneration + 12 core enums |
| `20260616000001_add_domain_models` | SupportRelationship, SupportMilestone, GoldStarProfile, StarHistory, RegionalBoost, TapStorm, TicketPurchase, TicketAttribution, PosterGeneration, CreatorHouse, CreatorHouseMember, CreatorSeason, ArenaVote, ArenaVoteResponse + 12 domain enums |
| `20260616000002_support_economy_fields` | Backfills SupporterProfile display fields and Subscription idempotency key; adds status index |
| `20260616000003_support_streaks_anniversaries` | SupportStreak table |
| `20260617000001_video_discovery` | Video, VideoWatch, ContentTap, DiscoveryScore, RegionalTapBoost, TrendingScore + Genre/VideoStatus enums |
| `20260617000002_content_index_unique_constraint` | Standalone `UNIQUE` on `ContentIndex.contentId` |

---

## Local development

```bash
# 1. Start PostgreSQL (first time or after docker compose down)
docker compose up -d postgres

# 2. Apply all pending migrations
cd apps/api
DATABASE_URL="postgresql://starria:starria@localhost:5432/starria" \
  npx prisma migrate deploy

# 3. Generate Prisma Client
npx prisma generate
```

---

## Production deployment (startup-safe)

Use `prisma migrate deploy` — **never** `prisma migrate dev` in production.

`migrate deploy` is:
- **Idempotent**: skips already-applied migrations.
- **Non-destructive**: never prompts, never resets data, never shadows.
- **Exit-code safe**: returns non-zero on failure so the deployment pipeline
  can catch it before traffic is routed.

### Recommended startup sequence

```dockerfile
# In the production Dockerfile (already present):
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
```

Or, in a Kubernetes init container / ECS task-def sidecar:

```yaml
initContainers:
  - name: migrate
    image: your-api-image
    command: ["npx", "prisma", "migrate", "deploy"]
    env:
      - name: DATABASE_URL
        valueFrom:
          secretKeyRef:
            name: starria-secrets
            key: DATABASE_URL
```

### Why not `prisma db push`?

`db push` is for prototyping — it reconciles the database directly from the
schema without generating migration files, so it can silently drop columns or
indexes. Always use `migrate deploy` in production.

### Rolling back

Prisma does not support automatic rollbacks. To undo a migration:

1. Write a new `migration.sql` that reverses the change (e.g., `DROP TABLE`,
   `ALTER TABLE ... DROP COLUMN`).
2. Place it in a new timestamped directory under `apps/api/prisma/migrations/`.
3. Deploy as normal with `migrate deploy`.

---

## ERD Summary

### Core identity

```
User ──────────────────────────────────────────────┐
  │                                                │
  ├─ StarProfile (1:1)                             │
  │    ├─ AiCreatorProfile (1:1)                   │
  │    │    └─ AiGeneration (1:N)                  │
  │    ├─ GoldStarProfile (1:1)                    │
  │    ├─ StarHistory (1:N)                        │
  │    ├─ Event (1:N) ──── Arena (N:1)             │
  │    │    ├─ WatchSession (1:N)                  │
  │    │    ├─ ContentIndex (1:1)                  │
  │    │    ├─ TicketPurchase (1:N)                │
  │    │    │    └─ TicketAttribution (1:1)        │
  │    │    └─ PosterGeneration (1:N)              │
  │    ├─ Arena (1:N)                              │
  │    │    └─ ArenaVote (1:N)                     │
  │    │         └─ ArenaVoteResponse (1:N)        │
  │    ├─ Video (1:N)                              │
  │    │    ├─ VideoWatch (1:N)                    │
  │    │    ├─ ContentTap (1:N)                    │
  │    │    ├─ DiscoveryScore (1:1)                │
  │    │    ├─ RegionalTapBoost (1:N)              │
  │    │    └─ TrendingScore (1:N)                 │
  │    ├─ TapStorm (1:N)                           │
  │    ├─ CreatorHouse (1:N, as owner)             │
  │    │    └─ CreatorHouseMember (1:N)            │
  │    └─ CreatorSeason (1:N)                      │
  │                                                │
  ├─ SupporterProfile (1:1)                        │
  │    ├─ Subscription (1:N)                       │
  │    └─ SupportRelationship (1:N)                │
  │         ├─ SupportStreak (1:1)                 │
  │         └─ SupportMilestone (1:N)              │
  │                                                │
  ├─ Wallet (1:1)                                  │
  │    └─ WalletEntry (1:N)                        │
  │                                                │
  ├─ Tap (1:N as sender, 1:N as receiver) ─────────┘
  │    └─ WalletEntry (1:N)
  │
  ├─ Notification (1:N)
  ├─ FeedEngagement (1:N)
  ├─ MediaUpload (1:N)
  ├─ ModerationReport (1:N, as reporter)
  └─ RegionalBoost (1:N, as authorizer)
```

### Table count by domain

| Domain | Tables |
|--------|--------|
| Identity | User, StarProfile, SupporterProfile |
| Subscriptions | Subscription, SupportRelationship, SupportStreak, SupportMilestone |
| Payments | Tap, Wallet, WalletEntry |
| Events & Arenas | Event, Arena, WatchSession, ArenaVote, ArenaVoteResponse |
| Ticketing | TicketPurchase, TicketAttribution |
| Creator tools | AiCreatorProfile, AiGeneration, PosterGeneration, CreatorHouse, CreatorHouseMember, CreatorSeason, TapStorm |
| Creator status | GoldStarProfile, StarHistory |
| Video discovery | Video, VideoWatch, ContentTap, DiscoveryScore, RegionalTapBoost, TrendingScore |
| Search | ContentIndex, RecommendationFeedback |
| Analytics | FeedEngagement |
| Notifications | Notification |
| Moderation | ModerationReport |
| Media | MediaUpload |
| Discovery boosts | RegionalBoost |

**Total: 39 tables, 24 enum types**
