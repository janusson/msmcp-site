# ─────────────────────────────────────────────────────────────────────────────
# Makefile — msmcp-site
#
# Local binaries come from node_modules (no `npx` network lookups) and every
# target depends on the install stamp, so a missing or stale node_modules
# cannot produce a confusing "command not found".
#
#   make check    fast, build-free: types + formatting
#   make verify   build the site, then assert the built HTML is sound
# ─────────────────────────────────────────────────────────────────────────────

.DEFAULT_GOAL := help

NODE_BIN := ./node_modules/.bin
STAMP := node_modules/.install-stamp

.PHONY: help deps dev preview lint format-check format-fix test verify build clean check all

## help          Show this help
help:
	@grep -E '^##[[:space:]]' $(MAKEFILE_LIST) | \
		sed -E 's/^##[[:space:]]+//' | \
		awk -F '[[:space:]]{2,}' '{ printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2 }'

## deps          Install/refresh dependencies (only when package files change)
deps: $(STAMP)

$(STAMP): package.json package-lock.json
	npm install --no-audit --no-fund
	@touch $(STAMP)

## dev           Run the Astro dev server
dev: $(STAMP)
	npm run dev

## preview       Serve the production build locally
preview: $(STAMP)
	npm run preview

## lint          Type-check the Astro/TS sources
lint: $(STAMP)
	$(NODE_BIN)/astro check

## format-check  Check formatting with Prettier
format-check: $(STAMP)
	$(NODE_BIN)/prettier --check .

## format-fix    Auto-fix formatting with Prettier
format-fix: $(STAMP)
	$(NODE_BIN)/prettier --write .

## build         Build the static site into dist/
build: $(STAMP)
	npm run build

## test          Verify the built HTML (runs a build first)
test: verify

## verify        Build, then assert anchors, links, tool names and metadata
verify: build
	node scripts/verify-build.mjs

## check         Fast pre-commit gate: types + formatting, no build
check: lint format-check

## clean         Remove build output and caches
clean:
	rm -rf dist .astro
	find public -name ".DS_Store" -type f -delete

## all           Full pipeline: check, verify
all: check verify
	@echo ""
	@echo "  All checks passed."
