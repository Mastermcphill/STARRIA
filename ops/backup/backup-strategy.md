# STARRIA Backup Strategy

## Database (PostgreSQL)

| Item | Value |
|------|-------|
| Schedule | Daily at 02:00 UTC (`0 2 * * *`) |
| Format | `pg_dump --format=custom --compress=9` |
| Destination | R2 → `backups/db/starria-db-<timestamp>.dump` |
| Retention | 30 days (older dumps auto-deleted by `backup-db.sh`) |
| Restore test | Weekly Sunday 03:00 UTC via `verify-backup.sh` against a throwaway DB |
| RTO target | < 2 hours |
| RPO target | < 24 hours |

### Running manually

```bash
export DATABASE_URL="..."
export R2_BUCKET="starria-media"
export R2_ACCOUNT_ID="..."
export R2_ACCESS_KEY_ID="..."
export R2_SECRET_ACCESS_KEY="..."
bash ops/backup/backup-db.sh
```

### Kubernetes CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: db-backup
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: postgres:16-alpine
              command: ["/scripts/backup-db.sh"]
              envFrom:
                - secretRef:
                    name: starria-backup-secrets
          restartPolicy: OnFailure
```

## Media / Object Storage (Cloudflare R2)

Cloudflare R2 does **not** support cross-region replication natively.

| Approach | Detail |
|----------|--------|
| Versioning | Enable R2 bucket versioning (Cloudflare dashboard → Bucket → Settings) |
| Cross-account copy | Weekly `rclone sync` from production R2 → a second R2 account or S3-compatible bucket |
| Retention | Keep 3 latest versions per object; lifecycle policy deletes older versions after 90 days |

### rclone sync (media)

```bash
# Configure rclone with two R2 remotes: r2-prod and r2-backup
rclone sync r2-prod:starria-media r2-backup:starria-media-backup \
  --transfers 16 --checkers 32 --log-level INFO
```

Schedule via cron: `0 3 * * 0` (weekly, after verify-backup.sh).

## Alerting

- Backup job failures → PagerDuty / Slack via a dead-man's-switch (e.g. Healthchecks.io).
- Each successful run should `curl https://hc-ping.com/<uuid>` at the end of the script.
