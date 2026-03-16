# ---------- Config ----------
# Override REPO_NAME if your GitHub repo has a different name.
REPO_NAME       ?= binance-earn-tracker
PAGES_BASE      ?= /$(REPO_NAME)/
GO_BINARY       ?= binance-earn-tracker
DATA_FILE       ?= data/flexible-earn.json
FRONTEND_DIR    ?= frontend
FRONTEND_PUBLIC ?= $(FRONTEND_DIR)/public
DIST_DIR        ?= $(FRONTEND_DIR)/dist

# ---------- Targets ----------

.PHONY: help build-go fetch sync build-frontend build-pages clean dev

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# --- Go ---

build-go: ## Build the Go CLI binary
	go build -o $(GO_BINARY) .

fetch: build-go ## Fetch fresh earn data from Binance (requires API_KEY + API_SECRET)
	./$(GO_BINARY) --output $(DATA_FILE)

sync: ## Copy data JSON into the frontend public folder
	cp $(DATA_FILE) $(FRONTEND_PUBLIC)/flexible-earn.json

# --- Frontend ---

install: ## Install frontend npm dependencies
	cd $(FRONTEND_DIR) && npm install

build-frontend: sync ## Build the frontend for local / generic hosting
	cd $(FRONTEND_DIR) && npm run build

build-pages: sync ## Build the frontend for GitHub Pages (sets base path)
	cd $(FRONTEND_DIR) && GITHUB_PAGES_BASE=$(PAGES_BASE) npm run build
	@# GitHub Pages needs a .nojekyll file so _ prefixed dirs work
	touch $(DIST_DIR)/.nojekyll

dev: sync ## Start the Vite dev server
	cd $(FRONTEND_DIR) && npm run dev

# --- Utilities ---

clean: ## Remove build artifacts
	rm -rf $(GO_BINARY) $(DIST_DIR)
