# Personal KB + Skill Hub

A personal developer knowledge base and skill management platform. Store solutions, search with full-text + graph relationships, and manage reusable AI skill files.

**Stack**: NestJS + Neo4j + Meilisearch + Redis | Bun CLI | Docker Compose | Caddy (auto-SSL)

---

## Quick Start (CLI Installation)

The CLI (`skill`) runs on your local machine and connects to the remote API server over HTTPS.

### Prerequisites

- **Node.js 18+** or **Bun 1.0+**
- **Git**

### Install on macOS

```bash
# Clone the repo
git clone https://github.com/truongnat/personal-ai.git
cd personal-ai/packages/cli

# Install dependencies
bun install

# Build the CLI binary
bun build src/index.ts --outfile dist/skill --target node

# Link globally
npm link

# Verify
skill --version
```

### Install on Linux

```bash
# Install bun if not present
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Clone and build
git clone https://github.com/truongnat/personal-ai.git
cd personal-ai/packages/cli
bun install
bun build src/index.ts --outfile dist/skill --target node
npm link

skill --version
```

### Install on Windows

```powershell
# Install bun (PowerShell)
irm bun.sh/install.ps1 | iex

# Clone and build
git clone https://github.com/truongnat/personal-ai.git
cd personal-ai\packages\cli
bun install
bun build src/index.ts --outfile dist/skill --target node
npm link

skill --version
```

### Alternative: Run without installing globally

If you don't want to `npm link`, you can run directly:

```bash
# macOS/Linux
cd personal-ai/packages/cli
bun run src/index.ts -- kb search "docker"

# Or create an alias
echo 'alias skill="bun run ~/personal-ai/packages/cli/src/index.ts --"' >> ~/.bashrc
source ~/.bashrc
```

---

## Configuration

After installing, configure the CLI to connect to your API server:

```bash
# Set the API endpoint
skill config set hub_url https://dev.truongsoftware.com

# Set your API key
skill config set api_key kb_live_YOUR_KEY_HERE
```

Config is stored at `~/.skill-cli/config.json` and persists across sessions.

### Generate a new API key

```bash
curl -X POST https://dev.truongsoftware.com/auth/generate-key \
  -H "x-master-password: YOUR_MASTER_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"label":"my-pc","expiresIn":"365d"}'
```

---

## CLI Usage

### Knowledge Base

```bash
# Search solutions
skill kb search "docker port conflict"
skill kb search "nestjs" --limit 5

# Push a new solution from a markdown file
skill kb push ./my-solution.md --tags "docker,linux" --project "my-project"

# List all solutions
skill kb list
skill kb list --tag docker
skill kb list --project personal-ai

# Get full solution content
skill kb get <solution-id>
```

### Skill Hub

```bash
# Install a skill from the hub
skill install dev-workflow
skill install dev-workflow@1.0.0    # specific version

# Publish a skill directory
skill publish ./my-skill-dir

# List installed skills
skill list

# Get skill details
skill info dev-workflow

# Update skills
skill update dev-workflow
skill update --all

# Compose multiple skills into one
skill compose --name full-flow --use dev-workflow --use testing --kb
```

### Configuration Management

```bash
skill config set hub_url https://dev.truongsoftware.com
skill config set api_key kb_live_xxxxx
skill config get hub_url
```

---

## Solution File Format

When pushing solutions, use this markdown format:

```markdown
# Title of the Solution

## Problem
Describe the problem you encountered.

## Solution
Explain how you solved it with code examples, commands, etc.

## Tags
comma, separated, tags

## Technologies
Tech1, Tech2, Tech3
```

The CLI extracts the H1 heading as the title and sends the full content to the KB.

---

## API Endpoints

All endpoints require `x-api-key` header (except auth which uses `x-master-password`).

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/generate-key` | Generate new API key (master auth) |
| GET | `/auth/keys` | List all API keys (master auth) |
| DELETE | `/auth/revoke-key/:id` | Revoke an API key (master auth) |
| POST | `/kb/push` | Push a new solution |
| GET | `/kb/search?q=query` | Search solutions |
| GET | `/kb/list` | List solutions (with filters) |
| GET | `/kb/:id` | Get solution by ID |
| PATCH | `/kb/:id` | Update a solution |
| DELETE | `/kb/:id` | Delete a solution |
| POST | `/skill/publish` | Publish a skill |
| GET | `/skill/install/:name` | Install a skill |
| GET | `/skill/search?q=query` | Search skills |
| GET | `/skill/list` | List all skills |
| GET | `/skill/:name` | Get skill details |
| POST | `/skill/compose` | Compose multiple skills |

### Rate Limits
- Search: 2 requests/second
- General: 5 requests/second
- Burst: 100 requests/minute

---

## Self-Hosting (VPS Deployment)

### Requirements
- Ubuntu 22.04+ VPS (2GB RAM minimum)
- Domain with DNS A record pointing to VPS IP
- Caddy or Nginx for reverse proxy

### One-Command Setup

```bash
# Set your GitHub token for private repo access
export GITHUB_TOKEN="ghp_your_token_here"

# Run the provisioning script
curl -fsSL https://raw.githubusercontent.com/truongnat/personal-ai/main/scripts/setup-vps.sh | bash
```

Or manually:

```bash
git clone https://${GITHUB_TOKEN}@github.com/truongnat/personal-ai.git /opt/personal-ai
cd /opt/personal-ai
bash scripts/setup-vps.sh
```

### What the setup script does:
1. Installs Docker + Docker Compose
2. Clones the repo to `/opt/personal-ai`
3. Generates random secrets (`.env`)
4. Configures UFW firewall (SSH + 80 + 443)
5. Starts Neo4j, Meilisearch, Redis, API containers
6. Sets up daily backup cron (2AM)
7. Runs health check

### After setup, configure Caddy:

```bash
# /etc/caddy/conf.d/kb.caddy
your-domain.com {
    reverse_proxy localhost:3456
    encode gzip zstd
}

systemctl reload caddy
```

### Deploy updates:

```bash
# From VPS
bash /opt/personal-ai/scripts/deploy.sh

# Or remotely via Makefile
make deploy
```

---

## Architecture

```
                    ┌─────────────┐
                    │   Caddy     │ (auto-SSL, ports 80/443)
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   KB API    │ (NestJS, port 3456)
                    └──┬───┬───┬──┘
                       │   │   │
          ┌────────────┘   │   └────────────┐
          │                │                │
   ┌──────▼──────┐ ┌──────▼──────┐ ┌───────▼─────┐
   │    Neo4j    │ │ Meilisearch │ │    Redis    │
   │  (graph DB) │ │  (search)   │ │   (cache)   │
   └─────────────┘ └─────────────┘ └─────────────┘
```

- **Neo4j**: Stores solutions, skills, tags, projects as graph nodes with relationships
- **Meilisearch**: Full-text search index for fast queries
- **Redis**: Cache layer (5-min TTL, invalidated on writes)
- **Caddy**: Reverse proxy with automatic Let's Encrypt SSL

---

## Development (Local)

```bash
# Start infrastructure
docker compose up -d neo4j meilisearch redis

# Run API in dev mode
cd apps/api
bun install
bun run start:dev

# Run CLI in dev mode
cd packages/cli
bun run src/index.ts -- kb search "test"
```

### Makefile commands

```bash
make up        # Start all containers
make down      # Stop all containers
make logs      # Follow API logs
make build     # Build API Docker image
make deploy    # Deploy to VPS (requires SSH access)
```

---

## Backup & Recovery

Daily automated backups run at 2AM via cron:
- Neo4j database dump
- Meilisearch data directory
- Compressed to `/opt/personal-ai/backups/`
- 7-day retention (older backups auto-deleted)

Manual backup:
```bash
bash /opt/personal-ai/scripts/backup.sh
```

---

## License

Private project by [@truongnat](https://github.com/truongnat)
