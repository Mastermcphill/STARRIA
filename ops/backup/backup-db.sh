#!/usr/bin/env bash
# PostgreSQL backup — runs nightly via cron or Kubernetes CronJob.
# Dumps are uploaded to R2 and retained for 30 days.
# Cron: 0 2 * * *   (02:00 UTC daily)

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"
: "${R2_BUCKET:?R2_BUCKET must be set}"
: "${R2_ACCOUNT_ID:?R2_ACCOUNT_ID must be set}"
: "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID must be set}"
: "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY must be set}"

TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
DUMP_FILE="/tmp/starria-db-${TIMESTAMP}.dump"

echo "[backup-db] Dumping database at ${TIMESTAMP}..."
pg_dump --format=custom --compress=9 "${DATABASE_URL}" -f "${DUMP_FILE}"

echo "[backup-db] Uploading to R2 backups/db/..."
AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
aws s3 cp "${DUMP_FILE}" \
  "s3://${R2_BUCKET}/backups/db/starria-db-${TIMESTAMP}.dump" \
  --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
  --storage-class STANDARD

rm -f "${DUMP_FILE}"

# Prune dumps older than 30 days.
echo "[backup-db] Pruning backups older than 30 days..."
CUTOFF=$(date -u -d "-30 days" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v-30d +"%Y-%m-%dT%H:%M:%SZ")
AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
aws s3 ls "s3://${R2_BUCKET}/backups/db/" \
  --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
  | awk '{print $4}' \
  | while read -r key; do
      file_ts="${key#starria-db-}"
      file_ts="${file_ts%.dump}"
      if [[ "${file_ts}" < "${CUTOFF:0:15}" ]]; then
        AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
        AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
        aws s3 rm "s3://${R2_BUCKET}/backups/db/${key}" \
          --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
        echo "[backup-db] Deleted old backup: ${key}"
      fi
    done

echo "[backup-db] Done."
