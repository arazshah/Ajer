#!/bin/sh
set -eu

: "${PGHOST:?PGHOST is required}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"

backup_dir="${BACKUP_DIR:-/backups}"
upload_dir="${UPLOAD_SOURCE_DIR:-/source/uploads}"
interval_seconds="${BACKUP_INTERVAL_SECONDS:-86400}"
retention_days="${BACKUP_RETENTION_DAYS:-14}"

mkdir -p "$backup_dir"

while true; do
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  database_file="$backup_dir/ajer-db-$timestamp.dump"
  uploads_file="$backup_dir/ajer-uploads-$timestamp.tar.gz"

  pg_dump --format=custom --no-owner --file="$database_file.partial" "$PGDATABASE"
  mv "$database_file.partial" "$database_file"

  if [ -d "$upload_dir" ]; then
    tar -C "$upload_dir" -czf "$uploads_file.partial" .
    mv "$uploads_file.partial" "$uploads_file"
  fi

  sha256sum "$database_file" > "$database_file.sha256"
  if [ -f "$uploads_file" ]; then
    sha256sum "$uploads_file" > "$uploads_file.sha256"
  fi

  date -u +%Y-%m-%dT%H:%M:%SZ > "$backup_dir/last-success.txt.partial"
  mv "$backup_dir/last-success.txt.partial" "$backup_dir/last-success.txt"

  find "$backup_dir" -type f -mtime "+$retention_days" -delete
  sleep "$interval_seconds"
done
