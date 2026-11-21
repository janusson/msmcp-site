# ─────────────────────────────────────────────────────────────────────────────
# Makefile — msmcp-site
#
# Local binaries come from node_modules (no `npx` network lookups) and every
# target depends on the install stamp, so a missing or stale node_modules
# cannot produce a confusing "command not found".
#
#   make check         fast, build-free: types + formatting + unit tests
#   make verify        build the site, then assert built HTML/assets/security
#   make test          run unit tests and post-build contract verification
#   make all           deterministic offline gate (used by CI)
#   make audit         npm vulnerability check (networked)
#   make check-links   verify external HTTPS URLs in built HTML (networked)
# ─────────────────────────────────────────────────────────────────────────────

.DEFAULT_GOAL := help

NODE_BIN := ./node_modules/.bin
STAMP := node_modules/.install-stamp

.PHONY: help deps ci-deps deps-sync dev preview lint format-check format-fix unit-test test verify build clean clean-all check audit outdated check-links all

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

## ci-deps       Install exact lockfile versions cleanly (like CI)
ci-deps:
	npm ci --no-audit --no-fund
	@touch $(STAMP)

## deps-sync     Verify package-lock.json satisfies package.json (offline)
deps-sync: $(STAMP)
	npm ci --dry-run --ignore-scripts --no-audit --no-fund --offline

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

## unit-test     Run fast offline unit and repo-contract tests
unit-test: $(STAMP)
	node --test tests/*.test.mjs

## verify        Build, then assert HTML, asset, security, and a11y contracts
verify: build
	node scripts/verify-build.mjs

## test          Run unit tests, build, and post-build contract verification
test: unit-test verify

## check         Fast pre-commit gate: types, formatting, and unit tests
check: lint format-check unit-test

## audit         Run npm security advisory audit (exits non-zero on findings)
audit: $(STAMP)
	npm audit

## outdated      Show outdated npm dependencies (informational report)
outdated: $(STAMP)
	npm outdated || true

## check-links   Verify external HTTPS links in dist/index.html resolve
check-links: build
	node scripts/check-links.mjs

## clean         Remove build output and caches
clean:
	rm -rf dist .astro
	find public -name ".DS_Store" -type f -delete

## clean-all     Remove build output, caches, and node_modules
clean-all: clean
	rm -rf node_modules

## all           Full offline pipeline: check, verify
all: check verify
	@echo ""
	@echo "  All checks passed."
