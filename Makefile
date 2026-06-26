# Microservices Shop — top-level Makefile
#
# Targets are documented below each rule with `##`. Run `make help` for a
# quick listing. Anything that mutates services or data requires the
# backend stack to be up (`make up`).

SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

COMPOSE        ?= docker compose
COMPOSE_FILE   ?= docker-compose.yml

# Service host ports (match docker-compose.yml mappings).
USER_PORT     ?= 8010
PRODUCT_PORT  ?= 8001
INVENTORY_PORT?= 8002
ORDER_PORT    ?= 8003
FRONTEND_PORT ?= 3000

USER_URL      ?= http://localhost:$(USER_PORT)
PRODUCT_URL   ?= http://localhost:$(PRODUCT_PORT)
ORDER_URL     ?= http://localhost:$(ORDER_PORT)

DATA_DIR      ?= $(CURDIR)/data

# ----------------------------------------------------------------------------
# Help (self-documenting)
# ----------------------------------------------------------------------------

.PHONY: help
help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "Usage:\n  make \033[36m<target>\033[0m\n\nTargets:\n"} \
	  /^[a-zA-Z0-9_-]+:.*?##/ {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' \
	  $(MAKEFILE_LIST)

# ----------------------------------------------------------------------------
# Stack lifecycle
# ----------------------------------------------------------------------------

.PHONY: up
up: ## Build and start all services in the background
	$(COMPOSE) -f $(COMPOSE_FILE) up -d --build

.PHONY: up-fast
up-fast: ## Start without rebuilding images (faster on rerun)
	$(COMPOSE) -f $(COMPOSE_FILE) up -d

.PHONY: down
down: ## Stop all services (keeps volumes)
	$(COMPOSE) -f $(COMPOSE_FILE) down

.PHONY: down-v
down-v: ## Stop all services AND delete volumes (full reset of DB data)
	$(COMPOSE) -f $(COMPOSE_FILE) down -v

.PHONY: restart
restart: down up ## Restart everything from scratch

.PHONY: rebuild
rebuild: ## Force a no-cache rebuild of all images
	$(COMPOSE) -f $(COMPOSE_FILE) build --no-cache

.PHONY: ps
ps: ## Show running service containers
	$(COMPOSE) -f $(COMPOSE_FILE) ps

.PHONY: status
status: ## Check health of every service
	@printf "%-18s %s\n" "Service" "Status"
	@printf "%-18s %s\n" "-------" "------"
	@for pair in \
	  "user-service:$(USER_PORT)" \
	  "product-service:$(PRODUCT_PORT)" \
	  "inventory-service:$(INVENTORY_PORT)" \
	  "order-service:$(ORDER_PORT)" \
	  "frontend:$(FRONTEND_PORT)"; do \
	    svc=$${pair%%:*}; port=$${pair##*:}; \
	    code=$$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:$$port/health 2>/dev/null || echo "----"); \
	    printf "%-18s %s\n" "$$svc" "$$code"; \
	  done

# ----------------------------------------------------------------------------
# Logs
# ----------------------------------------------------------------------------

.PHONY: logs
logs: ## Tail logs from every service
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f --tail=200

.PHONY: logs-svc
logs-svc: ## Tail logs from a single service (usage: make logs-svc S=user-service)
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f --tail=200 $(S)

# ----------------------------------------------------------------------------
# Seeding
# ----------------------------------------------------------------------------

.PHONY: seed
seed: ## Seed users, products, and orders from ./data/*.json
	@command -v jq >/dev/null || { echo "error: 'jq' is required (apt install jq)"; exit 1; }
	USER_URL=$(USER_URL) PRODUCT_URL=$(PRODUCT_URL) ORDER_URL=$(ORDER_URL) DATA_DIR=$(DATA_DIR) ./seed.sh

.PHONY: seed-reset
seed-reset: ## Wipe existing products then seed everything (best-effort reset)
	@command -v jq >/dev/null || { echo "error: 'jq' is required (apt install jq)"; exit 1; }
	USER_URL=$(USER_URL) PRODUCT_URL=$(PRODUCT_URL) ORDER_URL=$(ORDER_URL) DATA_DIR=$(DATA_DIR) RESET=1 ./seed.sh

.PHONY: seed-check
seed-check: ## Dry-run: verify /data/*.json parses without hitting the API
	@for f in $(DATA_DIR)/*.json; do \
	    jq empty "$$f" && echo "OK  $$f" || { echo "BAD $$f"; exit 1; }; \
	  done

# ----------------------------------------------------------------------------
# Frontend convenience
# ----------------------------------------------------------------------------

.PHONY: frontend-install
frontend-install: ## Install frontend npm dependencies
	cd frontend && npm install

.PHONY: frontend-dev
frontend-dev: ## Run Vite dev server on :5173 (talk to the frontend nginx via VITE_API_TARGET)
	cd frontend && VITE_API_TARGET=$${VITE_API_TARGET:-http://localhost:3000} npm run dev

.PHONY: frontend-build
frontend-build: ## Build the frontend bundle into frontend/dist
	cd frontend && npm run build

# ----------------------------------------------------------------------------
# Tests
# ----------------------------------------------------------------------------

.PHONY: test-e2e
test-e2e: ## Run Playwright e2e tests (requires `make up` + `make seed`)
	cd frontend && npm run test:e2e

.PHONY: test-e2e-ui
test-e2e-ui: ## Run Playwright e2e tests in CI mode (headless, no video, no trace)
	cd frontend && npx playwright test --headed --workers=1

.PHONY: test-e2e-install
test-e2e-install: ## Install Playwright browsers (one-time, ~150 MB)
	cd frontend && npm run test:e2e:install

# ----------------------------------------------------------------------------
# Cleanup
# ----------------------------------------------------------------------------

.PHONY: clean
clean: down ## Stop services and remove frontend build artifacts
	rm -rf frontend/dist frontend/node_modules

.PHONY: clean-all
clean-all: down-v clean ## Full wipe: volumes, build artifacts, node_modules

# ----------------------------------------------------------------------------
# Production: build, tag, push, and run from Docker Hub
# ----------------------------------------------------------------------------
#
# Docker Hub namespace is hardcoded to `asifmahmoud414`.
# Optional environment:
#   TAG             image tag (default: latest)
#   PLATFORMS       buildx platforms (default: linux/amd64)
#   BUILDER         buildx builder name (default: docker-container)
#
# Tagging policy: every prod-push also updates the `latest` tag, so
# `docker-compose.prod.yml` (which pulls `:latest`) always works.
#   TAG=0.0.1 make prod-push   -> pushes :0.0.1 AND :latest
#   make prod-push            -> pushes only :latest (no wasted bandwidth)
# Override with LATEST_TAG=no to push only $(TAG).
#
# docker-compose.prod.yml is fully self-contained — no .env, no exported
# secrets — so `make prod-up` works on a fresh machine with only Docker
# installed.
#
# Push requires `docker login` to have been run for asifmahmoud414.

TAG        ?= latest
PLATFORMS  ?= linux/amd64
BUILDER    ?= docker-container
LATEST_TAG ?= yes
PROD_COMPOSE_FILE ?= docker-compose.prod.yml

SERVICES := user-service product-service inventory-service order-service frontend

# Compose the `--tag` flags with late evaluation so command-line
# overrides of TAG / LATEST_TAG are honored. We emit both $(TAG) and
# `latest` unless TAG is already `latest` or LATEST_TAG=no.
define TAG_ARGS
$(if $(filter no,$(LATEST_TAG)),--tag asifmahmoud414/$(1):$(TAG),$(if $(filter latest,$(TAG)),--tag asifmahmoud414/$(1):$(TAG),--tag asifmahmoud414/$(1):$(TAG) --tag asifmahmoud414/$(1):latest))
endef

# Human-readable suffix describing what extra tag (if any) is being pushed.
define TAG_SUFFIX
$(if $(filter no,$(LATEST_TAG)),,$(if $(filter latest,$(TAG)),,+ latest))
endef

.PHONY: prod-builder
prod-builder: ## Create/reuse a docker buildx builder for multi-arch builds
	docker buildx inspect $(BUILDER) >/dev/null 2>&1 \
		|| docker buildx create --name $(BUILDER) --use
	docker buildx use $(BUILDER)

.PHONY: prod-build
prod-build: prod-builder ## Build every service image (loads into local docker)
	@set -e; \
	for svc in $(SERVICES); do \
	  echo ">> building asifmahmoud414/$$svc ($(TAG)$(TAG_SUFFIX))"; \
	  docker buildx build \
	    --platform $(PLATFORMS) \
	    $(call TAG_ARGS,$$svc) \
	    --load \
	    ./$$svc; \
	done

# Per-service build/push targets: `make prod-build-svc S=user-service`
.PHONY: prod-build-svc
prod-build-svc: prod-builder ## Build a single service image (usage: make prod-build-svc S=user-service)
	@test -n "$(S)" || { echo "usage: make prod-build-svc S=<service>"; exit 1; }
	docker buildx build \
	  --platform $(PLATFORMS) \
	  $(call TAG_ARGS,$(S)) \
	  --load \
	  ./$(S)

.PHONY: prod-push
prod-push: prod-builder ## Build AND push every service image to Docker Hub (keeps :latest in sync)
	@set -e; \
	for svc in $(SERVICES); do \
	  echo ">> pushing asifmahmoud414/$$svc ($(TAG)$(TAG_SUFFIX))"; \
	  docker buildx build \
	    --platform $(PLATFORMS) \
	    $(call TAG_ARGS,$$svc) \
	    --push \
	    ./$$svc; \
	done

.PHONY: prod-push-svc
prod-push-svc: prod-builder ## Build AND push a single service image (usage: make prod-push-svc S=user-service)
	@test -n "$(S)" || { echo "usage: make prod-push-svc S=<service>"; exit 1; }
	docker buildx build \
	  --platform $(PLATFORMS) \
	  $(call TAG_ARGS,$(S)) \
	  --push \
	  ./$(S)

.PHONY: prod-up
prod-up: ## Start the production stack from Docker Hub (no env vars required)
	$(COMPOSE) -f $(PROD_COMPOSE_FILE) up -d

.PHONY: prod-down
prod-down: ## Stop the production stack (keeps volumes)
	$(COMPOSE) -f $(PROD_COMPOSE_FILE) down

.PHONY: prod-down-v
prod-down-v: ## Stop the production stack AND delete volumes
	$(COMPOSE) -f $(PROD_COMPOSE_FILE) down -v

.PHONY: prod-logs
prod-logs: ## Tail logs from the production stack
	$(COMPOSE) -f $(PROD_COMPOSE_FILE) logs -f --tail=200

.PHONY: prod-ps
prod-ps: ## Show production stack containers
	$(COMPOSE) -f $(PROD_COMPOSE_FILE) ps

.PHONY: prod-pull
prod-pull: ## Pull every service image from Docker Hub
	$(COMPOSE) -f $(PROD_COMPOSE_FILE) pull