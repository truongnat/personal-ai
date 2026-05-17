VPS_HOST=62.146.238.102
VPS_USER=root
VPS_DIR=/opt/personal-ai

.PHONY: up down logs dev build restart ps deploy setup-vps

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f api

dev:
	cd apps/api && bun run start:dev

build:
	cd apps/api && bun run build

restart:
	docker compose restart api

ps:
	docker compose ps

shell-neo4j:
	docker exec -it neo4j cypher-shell -u neo4j -p $$NEO4J_PASSWORD

shell-redis:
	docker exec -it redis redis-cli -a $$REDIS_PASSWORD

setup-vps:
	ssh $(VPS_USER)@$(VPS_HOST) "bash -s" < scripts/setup-vps.sh

deploy:
	ssh $(VPS_USER)@$(VPS_HOST) "bash $(VPS_DIR)/scripts/deploy.sh"
