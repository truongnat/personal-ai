#!/bin/bash
# Deploy latest code from GitHub to VPS
# Run from /opt/personal-ai or via: bash /opt/personal-ai/scripts/deploy.sh
set -euo pipefail

APP_DIR="/opt/personal-ai"
GREEN='\033[0;32m'; NC='\033[0m'
log() { echo -e "${GREEN}[deploy]${NC} $*"; }

cd "$APP_DIR"

log "Pulling latest code..."
git pull --ff-only

log "Rebuilding API image..."
docker compose build api

log "Restarting API..."
docker compose up -d --no-deps api

log "Waiting for API to start..."
sleep 8

HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/auth/keys \
  -H "x-master-password: $(grep MASTER_PASSWORD .env | cut -d= -f2)" 2>/dev/null || echo "000")

if [ "$HTTP" = "200" ]; then
  log "✅ Deploy successful — API healthy"
else
  echo "API returned $HTTP — check: docker compose logs api"
  exit 1
fi
