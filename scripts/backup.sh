#!/bin/bash
set -euo pipefail

DATE=$(date +%Y%m%d)
BACKUP_DIR="/backup"
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup..."

# Backup Neo4j
docker exec neo4j neo4j-admin database dump neo4j \
  --to-path=/var/lib/neo4j/backup
echo "[$(date)] Neo4j dump done"

# Backup Meilisearch data folder
docker cp meilisearch:/meili_data "$BACKUP_DIR/meili_${DATE}"
echo "[$(date)] Meilisearch copy done"

# Compress
tar -czf "$BACKUP_DIR/kb_backup_${DATE}.tar.gz" \
  /var/lib/neo4j/backup \
  "$BACKUP_DIR/meili_${DATE}"

# Remove raw copy
rm -rf "$BACKUP_DIR/meili_${DATE}"

# Upload to S3/R2 (uncomment and configure if needed)
# aws s3 cp "$BACKUP_DIR/kb_backup_${DATE}.tar.gz" s3://your-bucket/kb-backups/

# Cleanup backups older than 7 days
find "$BACKUP_DIR" -name "kb_backup_*.tar.gz" -mtime +7 -delete

echo "[$(date)] Backup complete: kb_backup_${DATE}.tar.gz"
