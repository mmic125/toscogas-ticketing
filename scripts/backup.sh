#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/opt/toscogas/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30
LOG_PREFIX="[BACKUP $DATE]"
ENCRYPT_KEY="${BACKUP_ENCRYPT_KEY:-}"
WASABI_BUCKET="wasabi/webticket-backup-hetzner"

mkdir -p "$BACKUP_DIR"
echo "$LOG_PREFIX Inizio backup..."

# ── Dump PostgreSQL ───────────────────────────────────────────
echo "$LOG_PREFIX Dump PostgreSQL..."
DB_DUMP="$BACKUP_DIR/db_${DATE}.sql.gz"
sudo -u postgres pg_dump toscogas | gzip > "$DB_DUMP"
echo "$LOG_PREFIX DB dump: $DB_DUMP ($(du -sh "$DB_DUMP" | cut -f1))"

# ── Backup MinIO storage ──────────────────────────────────────
echo "$LOG_PREFIX Backup MinIO..."
MINIO_DUMP="$BACKUP_DIR/minio_${DATE}.tar.gz"
tar czf "$MINIO_DUMP" /var/lib/minio 2>/dev/null || true
echo "$LOG_PREFIX MinIO dump: $MINIO_DUMP ($(du -sh "$MINIO_DUMP" | cut -f1))"

# ── Backup configurazioni ─────────────────────────────────────
echo "$LOG_PREFIX Backup configurazioni..."
CONFIG_DUMP="$BACKUP_DIR/config_${DATE}.tar.gz"
tar czf "$CONFIG_DUMP" \
  /etc/toscogas/secrets \
  /var/www/toscogas/backend/.env \
  /var/www/toscogas/backend/ecosystem.config.js \
  /etc/nginx/sites-available/toscogas \
  /etc/letsencrypt/live \
  /etc/letsencrypt/renewal \
  2>/dev/null || true
echo "$LOG_PREFIX Config dump: $CONFIG_DUMP ($(du -sh "$CONFIG_DUMP" | cut -f1))"

# ── Cifratura AES-256 ─────────────────────────────────────────
if [[ -n "$ENCRYPT_KEY" ]]; then
  echo "$LOG_PREFIX Cifratura backup..."
  for f in "$DB_DUMP" "$MINIO_DUMP" "$CONFIG_DUMP"; do
    openssl enc -aes-256-cbc -pbkdf2 -iter 100000 \
      -k "$ENCRYPT_KEY" \
      -in "$f" -out "${f}.enc"
    rm -f "$f"
  done
  echo "$LOG_PREFIX Backup cifrati."
else
  echo "$LOG_PREFIX ATTENZIONE: BACKUP_ENCRYPT_KEY non impostata — backup non cifrati!"
fi

# ── Upload su Wasabi (offsite) ────────────────────────────────
echo "$LOG_PREFIX Upload su Wasabi..."
UPLOAD_OK=true
for f in "$BACKUP_DIR"/*_${DATE}*.enc; do
  if ! mc cp "$f" "$WASABI_BUCKET/" 2>&1; then
    UPLOAD_OK=false
    echo "$LOG_PREFIX ERRORE upload: $f"
  fi
done
if $UPLOAD_OK; then
  echo "$LOG_PREFIX Upload Wasabi completato."
else
  echo "$LOG_PREFIX ATTENZIONE: alcuni upload su Wasabi sono falliti!"
fi

# ── Pulizia vecchi backup (solo locale) ───────────────────────
echo "$LOG_PREFIX Pulizia backup locali > ${RETENTION_DAYS} giorni..."
find "$BACKUP_DIR" -type f -mtime +$RETENTION_DAYS -delete

BACKUP_COUNT=$(find "$BACKUP_DIR" -type f | wc -l)
echo "$LOG_PREFIX Backup completato. File locali: $BACKUP_COUNT"
