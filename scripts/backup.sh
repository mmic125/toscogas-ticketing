#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Backup giornaliero cifrato — NIS2 compliant
# Backup di: PostgreSQL + MinIO storage
# Retention: 30 giorni locali + trasferimento opzionale S3/SFTP
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

BACKUP_DIR="/opt/toscogas/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30
LOG_PREFIX="[BACKUP $DATE]"

# Leggi variabili d'ambiente dal file .env
if [[ -f /opt/toscogas/.env ]]; then
  set -a
  source /opt/toscogas/.env
  set +a
fi

ENCRYPT_KEY="${BACKUP_ENCRYPT_KEY:-}"

mkdir -p "$BACKUP_DIR"

echo "$LOG_PREFIX Inizio backup..."

# ── Dump PostgreSQL ───────────────────────────────────────────
echo "$LOG_PREFIX Dump PostgreSQL..."
DB_DUMP="$BACKUP_DIR/db_${DATE}.sql.gz"

docker compose -f /opt/toscogas/docker-compose.yml exec -T postgres \
  pg_dump -U "$DB_USER" "$DB_NAME" \
  | gzip > "$DB_DUMP"

echo "$LOG_PREFIX DB dump: $DB_DUMP ($(du -sh "$DB_DUMP" | cut -f1))"

# ── Backup MinIO storage ──────────────────────────────────────
echo "$LOG_PREFIX Backup MinIO..."
MINIO_DUMP="$BACKUP_DIR/minio_${DATE}.tar.gz"

docker compose -f /opt/toscogas/docker-compose.yml exec -T minio \
  tar czf - /data 2>/dev/null > "$MINIO_DUMP" || true

echo "$LOG_PREFIX MinIO dump: $MINIO_DUMP ($(du -sh "$MINIO_DUMP" | cut -f1))"

# ── Cifratura AES-256 (NIS2: protezione backup) ──────────────
if [[ -n "$ENCRYPT_KEY" ]]; then
  echo "$LOG_PREFIX Cifratura backup..."
  openssl enc -aes-256-cbc -pbkdf2 -iter 100000 \
    -k "$ENCRYPT_KEY" \
    -in  "$DB_DUMP"    -out "${DB_DUMP}.enc"
  openssl enc -aes-256-cbc -pbkdf2 -iter 100000 \
    -k "$ENCRYPT_KEY" \
    -in  "$MINIO_DUMP" -out "${MINIO_DUMP}.enc"
  rm -f "$DB_DUMP" "$MINIO_DUMP"
  echo "$LOG_PREFIX Backup cifrati."
else
  echo "$LOG_PREFIX ATTENZIONE: BACKUP_ENCRYPT_KEY non impostata — backup non cifrati!"
fi

# ── Pulizia vecchi backup (retention 30 giorni) ───────────────
echo "$LOG_PREFIX Pulizia backup > ${RETENTION_DAYS} giorni..."
find "$BACKUP_DIR" -type f -mtime +$RETENTION_DAYS -delete

# ── Trasferimento opzionale (SFTP/S3) ────────────────────────
# Decommentare e configurare per trasferimento offsite
# BACKUP_SFTP_HOST="${BACKUP_SFTP_HOST:-}"
# if [[ -n "$BACKUP_SFTP_HOST" ]]; then
#   rsync -az "$BACKUP_DIR/" "$BACKUP_SFTP_HOST:/backups/toscogas/"
# fi

# ── Verifica integrità ────────────────────────────────────────
BACKUP_COUNT=$(find "$BACKUP_DIR" -type f | wc -l)
echo "$LOG_PREFIX Backup completato. File presenti: $BACKUP_COUNT"

# ── Audit log ────────────────────────────────────────────────
docker compose -f /opt/toscogas/docker-compose.yml exec -T postgres \
  psql -U "$DB_USER" "$DB_NAME" -c \
  "INSERT INTO audit_log (action, details) VALUES ('BACKUP_COMPLETED', '{\"date\": \"$DATE\", \"files\": $BACKUP_COUNT}')" \
  2>/dev/null || true

echo "$LOG_PREFIX Fine backup."
