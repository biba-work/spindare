#!/bin/bash
# Nightly dump of the Spindare Postgres database (Supabase-hosted, no PITR on
# the free tier — this is the only backup that exists). Keeps 14 days locally.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$SERVER_DIR/backups"
ENV_FILE="$SERVER_DIR/.env"

mkdir -p "$BACKUP_DIR"

DATABASE_URL="$(awk -F= '/^DATABASE_URL=/{sub(/^DATABASE_URL=/,""); print}' "$ENV_FILE" | tr -d '"')"
if [ -z "$DATABASE_URL" ]; then
  echo "backup-db: DATABASE_URL not found in $ENV_FILE" >&2
  exit 1
fi

STAMP="$(date +%Y-%m-%d_%H%M%S)"
OUT_FILE="$BACKUP_DIR/spindare_${STAMP}.sql.gz"

PG_DUMP_BIN="pg_dump"
if [ -x /usr/local/opt/postgresql@17/bin/pg_dump ]; then
  PG_DUMP_BIN="/usr/local/opt/postgresql@17/bin/pg_dump"
elif [ -x /opt/homebrew/opt/postgresql@17/bin/pg_dump ]; then
  PG_DUMP_BIN="/opt/homebrew/opt/postgresql@17/bin/pg_dump"
fi

"$PG_DUMP_BIN" "$DATABASE_URL" --no-owner --no-privileges | gzip > "$OUT_FILE"

echo "backup-db: wrote $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"

# Off-machine copy — survives this Mac being off or dead. Local dump above is
# kept too, for a fast/free restore path that doesn't need network access.
(cd "$SERVER_DIR" && node scripts/upload-backup.js "$OUT_FILE")

# Prune anything older than 14 days.
find "$BACKUP_DIR" -name 'spindare_*.sql.gz' -mtime +14 -delete
