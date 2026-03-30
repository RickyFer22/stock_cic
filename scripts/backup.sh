#!/usr/bin/env bash
set -euo pipefail

umask 077

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DATE_YYYYMMDD="$(date +%Y%m%d)"
FILENAME="backup_san_roque_${DATE_YYYYMMDD}.sql"
OUT_PATH="${BACKUP_DIR}/${FILENAME}"
TMP_PATH="${BACKUP_DIR}/.${FILENAME}.tmp"

mkdir -p "${BACKUP_DIR}"

echo "[backup] $(date -Is) starting: ${OUT_PATH}" >&2

: "${PGHOST:=db}"
: "${PGPORT:=5432}"
: "${PGUSER:?Missing PGUSER}"
: "${PGDATABASE:?Missing PGDATABASE}"

# PGPASSWORD se toma de env var (compose)
pg_dump \
  --host="${PGHOST}" \
  --port="${PGPORT}" \
  --username="${PGUSER}" \
  --dbname="${PGDATABASE}" \
  --no-owner \
  --no-acl \
  --format=plain \
  > "${TMP_PATH}"

mv -f "${TMP_PATH}" "${OUT_PATH}"

# Retención 30 días
find "${BACKUP_DIR}" -type f -name 'backup_san_roque_*.sql' -mtime +30 -print -delete || true

echo "[backup] $(date -Is) done" >&2

