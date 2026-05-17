#!/bin/bash
# One-shot VPS provisioning for Personal KB + Skill Hub
# Usage: bash setup-vps.sh
set -euo pipefail

REPO="https://github.com/truongnat/personal-ai.git"
APP_DIR="/opt/personal-ai"
DOMAIN="dev.truongsoftware.com"
EMAIL="truongdq.dev@gmail.com"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[setup]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC}  $*"; }
die()  { echo -e "${RED}[error]${NC} $*"; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run as root"

# ── 1. System packages ──────────────────────────────────────────────────────
log "Updating system packages..."
apt-get update -qq
apt-get install -y -qq curl git openssl ufw certbot python3-certbot-nginx

# ── 2. Docker ───────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  log "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  log "Docker already installed: $(docker --version)"
fi

if ! docker compose version &>/dev/null; then
  log "Installing Docker Compose plugin..."
  apt-get install -y -qq docker-compose-plugin
fi

# ── 3. Clone repo ───────────────────────────────────────────────────────────
if [ -d "$APP_DIR/.git" ]; then
  log "Repo already cloned — pulling latest..."
  git -C "$APP_DIR" pull --ff-only
else
  log "Cloning repo to $APP_DIR..."
  git clone "$REPO" "$APP_DIR"
fi

cd "$APP_DIR"

# ── 4. Generate .env ────────────────────────────────────────────────────────
if [ -f .env ]; then
  warn ".env already exists — skipping generation (delete it to regenerate)"
else
  log "Generating .env with random secrets..."
  NEO4J_PASS=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32)
  MEILI_KEY=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 40)
  REDIS_PASS=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32)
  MASTER_PASS=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 40)

  cat > .env <<EOF
# Master Auth
MASTER_PASSWORD=${MASTER_PASS}

# Neo4j
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=${NEO4J_PASS}

# Meilisearch
MEILI_MASTER_KEY=${MEILI_KEY}
MEILI_HOST=http://meilisearch:7700

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASS}

# App
PORT=3000
NODE_ENV=production
EOF

  log "MASTER_PASSWORD = ${MASTER_PASS}"
  log "Secrets saved to .env — write down MASTER_PASSWORD above!"
fi

# ── 5. Fix docker-compose Redis port (use 6379 on VPS, no conflicts) ────────
# On VPS port 6379 is free; restore the standard mapping
sed -i 's/- "6380:6379"/- "6379:6379"/' docker-compose.yml || true

# ── 6. Firewall ─────────────────────────────────────────────────────────────
log "Configuring UFW firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
log "Firewall enabled"

# ── 7. Build and start infrastructure ───────────────────────────────────────
log "Starting infrastructure containers (Neo4j, Meilisearch, Redis)..."
docker compose up -d neo4j meilisearch redis
log "Waiting 30s for Neo4j to initialize..."
sleep 30

# ── 8. Build API Docker image ────────────────────────────────────────────────
log "Building API Docker image..."
docker compose build api

# ── 9. Start API ─────────────────────────────────────────────────────────────
log "Starting API..."
docker compose up -d api

# ── 10. SSL certificate ───────────────────────────────────────────────────────
log "Obtaining SSL certificate for $DOMAIN..."
# Temporarily start nginx without SSL to pass the ACME challenge
# First, get a temp nginx config that handles HTTP only for certbot
cat > /tmp/nginx-certbot.conf <<'NGINXEOF'
events { worker_connections 1024; }
http {
  server {
    listen 80;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 200 'ok'; }
  }
}
NGINXEOF

docker run -d --name nginx-tmp \
  -v /tmp/nginx-certbot.conf:/etc/nginx/nginx.conf:ro \
  -v /var/www/certbot:/var/www/certbot \
  -p 80:80 nginx:alpine 2>/dev/null || true

mkdir -p /var/www/certbot
certbot certonly --webroot \
  --webroot-path /var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN" || warn "SSL cert failed — run manually after DNS is set"

docker rm -f nginx-tmp 2>/dev/null || true

# ── 11. Start Nginx with SSL ──────────────────────────────────────────────────
log "Starting Nginx..."
docker compose up -d nginx

# ── 12. Backup cron ───────────────────────────────────────────────────────────
log "Setting up daily backup cron..."
chmod +x "$APP_DIR/scripts/backup.sh"
CRON_LINE="0 2 * * * $APP_DIR/scripts/backup.sh >> /var/log/kb-backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'kb-backup'; echo "$CRON_LINE" ) | crontab -
log "Cron set: daily 2AM backup"

# ── 13. Auto-deploy hook ──────────────────────────────────────────────────────
log "Installing systemd service for deploy..."
cat > /etc/systemd/system/kb-deploy.service <<'SVCEOF'
[Unit]
Description=Personal KB deploy hook
After=network.target docker.service

[Service]
Type=oneshot
WorkingDirectory=/opt/personal-ai
ExecStart=/opt/personal-ai/scripts/deploy.sh
User=root
SVCEOF
systemctl daemon-reload

# ── 14. Health check ─────────────────────────────────────────────────────────
log "Waiting for API to be healthy..."
sleep 10
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/auth/keys \
  -H "x-master-password: $(grep MASTER_PASSWORD .env | cut -d= -f2)" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
  log "✅ API healthy (HTTP 200)"
else
  warn "API returned HTTP $HTTP_CODE — check: docker compose logs api"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo -e "${GREEN}  Personal KB + Skill Hub — Setup Done   ${NC}"
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo ""
echo "  API:          https://$DOMAIN"
echo "  Neo4j UI:     http://$(hostname -I | awk '{print $1}'):7474  (block from outside)"
echo "  App dir:      $APP_DIR"
echo "  Logs:         docker compose logs -f api"
echo "  Deploy:       bash $APP_DIR/scripts/deploy.sh"
echo "  Backup log:   /var/log/kb-backup.log"
echo ""
MASTER=$(grep MASTER_PASSWORD .env | cut -d= -f2)
echo "  Generate first API key:"
echo "    curl -X POST https://$DOMAIN/auth/generate-key \\"
echo "      -H 'x-master-password: $MASTER' \\"
echo "      -H 'Content-Type: application/json' \\"
echo "      -d '{\"label\":\"cli\",\"expiresIn\":\"365d\"}'"
echo ""
