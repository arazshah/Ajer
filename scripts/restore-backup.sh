#!/bin/sh
set -eu

if [ "${ALLOW_RESTORE:-no}" != "yes" ]; then
  echo "Restore is blocked. Set ALLOW_RESTORE=yes after stopping the Ajer service." >&2
  exit 2
fi

: "${PGHOST:?PGHOST is required}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"

database_file="${1:-}"
uploads_file="${2:-}"

if [ -z "$database_file" ] || [ ! -f "$database_file" ]; then
  echo "Usage: restore-backup /backups/ajer-db-TIMESTAMP.dump [/backups/ajer-uploads-TIMESTAMP.tar.gz]" >&2
  exit 2
fi

if [ -f "$database_file.sha256" ]; then
  sha256sum -c "$database_file.sha256"
fi

pg_restore --clean --if-exists --no-owner --dbname="$PGDATABASE" "$database_file"

if [ -n "$uploads_file" ]; then
  if [ ! -f "$uploads_file" ]; then
    echo "Upload archive was not found." >&2
    exit 2
  fi
  if [ -f "$uploads_file.sha256" ]; then
    sha256sum -c "$uploads_file.sha256"
  fi
  mkdir -p "${UPLOAD_SOURCE_DIR:-/source/uploads}"
  tar -C "${UPLOAD_SOURCE_DIR:-/source/uploads}" -xzf "$uploads_file"
  chown -R 1001:1001 "${UPLOAD_SOURCE_DIR:-/source/uploads}"
fi

echo "Restore completed. Run migrations and the operational smoke tests before starting traffic."
