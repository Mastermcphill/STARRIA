#!/usr/bin/env bash
# Restore the latest DB backup into a throwaway database and run a row count.
# Run weekly (e.g. every Sunday 03:00 UTC) to confirm restores work.
# Cron: 0 3 * * 0

set -euo pipefail

: "${R2_BUCKET:?}"
: "${R2_ACCOUNT_ID:?}"
: "${R2_ACCESS_KEY_ID:?}"
: "${R2_SECRET_ACCESS_KEY:?}"
: "${VERIFY_DB_URL:?VERIFY_DB_URL must point to a throwaway postgres instance}"

LATEST=$(
  AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
  AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
  aws s3 ls "s3://${R2_BUCKET}/backups/db/" \
    --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
  | sort | tail -1 | awk '{print $4}'
)

echo "[verify-backup] Restoring ${LATEST}..."
TMP="/tmp/${LATEST}"

AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
aws s3 cp \
  "s3://${R2_BUCKET}/backups/db/${LATEST}" "${TMP}" \
  --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

pg_restore --clean --if-exists -d "${VERIFY_DB_URL}" "${TMP}"
COUNT=$(psql "${VERIFY_DB_URL}" -tAc 'SELECT COUNT(*) FROM "User"')
echo "[verify-backup] Restore OK — User row count: ${COUNT}"

rm -f "${TMP}"
