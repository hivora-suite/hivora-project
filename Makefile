# Builds, virtualenv and caches stay off the /mnt/hgfs share (slow, unreliable for SQLite).
WORK ?= $(HOME)/.cache/hivora-project
FRONT := $(WORK)/frontend
export UV_PROJECT_ENVIRONMENT := $(WORK)/venv
export RUFF_CACHE_DIR := $(WORK)/ruff
export MYPY_CACHE_DIR := $(WORK)/mypy
export PYTHONDONTWRITEBYTECODE := 1
export HIVORA_PROJECT_FRONTEND_DIR := $(FRONT)/out
SERVER := cd $(CURDIR)/backend && uv run -q uvicorn --factory hivora_project.main:create_app
# `make run` listens on the VM's own address only, reachable from the host machine.
VM_ADDRESS := $(shell hostname -I | cut -d' ' -f1)

.PHONY: check e2e gen run lock hooks sync build

check: build
	@sh scripts/check-docs.sh
	@sh scripts/check-secrets.sh
	@cd backend && uv sync -q --locked
	@cd backend && uv run -q ruff format -q --check src tests scripts
	@cd backend && uv run -q ruff check -q src tests scripts
	@cd backend && uv run -q mypy --no-error-summary src tests scripts
	@cd backend && uv run -q pytest -q --no-header -p no:cacheprovider
	@cd $(FRONT) && npm run -s lint
	@cd $(FRONT) && npm run -s check:bundle > $(WORK)/bundle.log 2>&1 || (cat $(WORK)/bundle.log; exit 1)
	@echo "check: ok"

# Copy the sources off the share, then install only when the lockfile changed.
sync:
	@mkdir -p $(FRONT)
	@rsync -a --delete --exclude node_modules --exclude .next --exclude out --exclude next-env.d.ts --exclude '*.tsbuildinfo' --exclude test-results frontend/ $(FRONT)/
	@$(MAKE) -s $(FRONT)/node_modules/.stamp

$(FRONT)/node_modules/.stamp: frontend/package-lock.json
	@cd $(FRONT) && npm ci --no-audit --no-fund --silent
	@touch $@

build: sync
	@cd $(FRONT) && npm run -s build > $(WORK)/build.log 2>&1 || (tail -30 $(WORK)/build.log; exit 1)

e2e: build
	@cd backend && uv sync -q --locked
	@cd $(FRONT) && E2E_SERVER="$(SERVER) --host 127.0.0.1" npm run -s e2e

# Regenerate the frontend's API types from the backend's routes.
gen:
	@cd backend && uv run -q python scripts/export_openapi.py $(CURDIR)/frontend/lib/api/openapi.json >/dev/null
	@npx --yes -p typescript@5 -p openapi-typescript@7 openapi-typescript frontend/lib/api/openapi.json -o frontend/lib/api/schema.d.ts --silent

run: build
	@cd backend && uv sync -q --locked
	@echo "http://$(VM_ADDRESS):8000"
	@$(SERVER) --host $(VM_ADDRESS) --port 8000

# After a change to package.json.
lock:
	@mkdir -p $(FRONT)
	@cp frontend/package.json $(FRONT)/
	@cd $(FRONT) && npm install --package-lock-only --no-audit --no-fund --silent
	@cp $(FRONT)/package-lock.json frontend/

hooks:
	@printf '#!/bin/sh\nexec sh scripts/check-secrets.sh --staged\n' > .git/hooks/pre-commit
	@chmod +x .git/hooks/pre-commit
	@graphify hook install > /dev/null
