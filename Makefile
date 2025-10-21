.PHONY: help install dev build clean deploy test lint status setup

# Variables
DEPLOY_DIR=/var/www/aladin-frontend
PORT=3000

# Colors
BLUE=\033[0;34m
GREEN=\033[0;32m
YELLOW=\033[1;33m
NC=\033[0m # No Color

##@ Help
help: ## Display this help
	@echo "$(GREEN)Aladin Front-end - Makefile Commands$(NC)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "Usage:\n  make $(BLUE)<target>$(NC)\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  $(BLUE)%-15s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(YELLOW)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Development
install: ## Install dependencies
	@echo "$(BLUE)Installing dependencies...$(NC)"
	npm ci
	@echo "$(GREEN)✓ Dependencies installed$(NC)"

dev: ## Run development server
	@echo "$(BLUE)Starting development server...$(NC)"
	npm run dev

build: ## Build for production
	@echo "$(BLUE)Building application...$(NC)"
	npm run build
	@echo "$(GREEN)✓ Build completed$(NC)"

build-prod: ## Build for production with production mode
	@echo "$(BLUE)Building application (production mode)...$(NC)"
	npm run build:prod
	@echo "$(GREEN)✓ Production build completed$(NC)"

preview: ## Preview production build
	@echo "$(BLUE)Starting preview server...$(NC)"
	npm run preview

clean: ## Clean build artifacts
	@echo "$(BLUE)Cleaning build artifacts...$(NC)"
	rm -rf dist node_modules/.vite
	@echo "$(GREEN)✓ Clean completed$(NC)"

clean-all: ## Clean all generated files including node_modules
	@echo "$(YELLOW)⚠️  Removing all generated files...$(NC)"
	rm -rf dist node_modules node_modules/.vite package-lock.json
	@echo "$(GREEN)✓ All clean completed$(NC)"

##@ Deployment (PM2)
deploy: build pm2-deploy ## Build and deploy with PM2
	@echo "$(GREEN)✓ Deployment completed$(NC)"
	@echo "$(GREEN)→ Access at: http://localhost:$(PORT)$(NC)"

pm2-deploy: ## Deploy with PM2
	@echo "$(BLUE)Deploying frontend with PM2...$(NC)"
	@pm2 delete aladin-frontend-prod 2>/dev/null || true
	@pm2 start ecosystem.config.cjs --only aladin-frontend-prod --env production
	@pm2 save
	@echo "$(GREEN)✓ PM2 deployment completed$(NC)"

pm2-dev: ## Start development server with PM2
	@echo "$(BLUE)Starting dev server with PM2...$(NC)"
	@pm2 delete aladin-frontend-dev 2>/dev/null || true
	@pm2 start ecosystem.config.cjs --only aladin-frontend-dev
	@pm2 save
	@echo "$(GREEN)✓ Dev server started$(NC)"
	@echo "$(GREEN)→ Access at: http://localhost:5173$(NC)"

pm2-stop: ## Stop PM2 processes
	@echo "$(BLUE)Stopping PM2 processes...$(NC)"
	@pm2 stop ecosystem.config.cjs || true
	@echo "$(GREEN)✓ PM2 processes stopped$(NC)"

pm2-delete: ## Delete PM2 processes
	@echo "$(BLUE)Deleting PM2 processes...$(NC)"
	@pm2 delete ecosystem.config.cjs || true
	@echo "$(GREEN)✓ PM2 processes deleted$(NC)"

pm2-restart: ## Restart PM2 processes
	@echo "$(BLUE)Restarting PM2 processes...$(NC)"
	@pm2 restart ecosystem.config.cjs
	@echo "$(GREEN)✓ PM2 processes restarted$(NC)"

pm2-logs: ## Show PM2 logs
	@pm2 logs aladin-frontend-prod

pm2-monit: ## Show PM2 monitoring
	@pm2 monit

pm2-status: ## Show PM2 status
	@pm2 status

##@ Quality
lint: ## Run linter (if configured)
	@echo "$(BLUE)Running linter...$(NC)"
	@npm run lint 2>/dev/null || echo "$(YELLOW)No lint script configured$(NC)"

type-check: ## Run TypeScript type checking
	@echo "$(BLUE)Running type check...$(NC)"
	npx tsc --noEmit
	@echo "$(GREEN)✓ Type check passed$(NC)"

format: ## Format code (if prettier is configured)
	@echo "$(BLUE)Formatting code...$(NC)"
	@npx prettier --write src/ 2>/dev/null || echo "$(YELLOW)Prettier not configured$(NC)"

audit: ## Check for security vulnerabilities
	@echo "$(BLUE)Running security audit...$(NC)"
	npm audit

##@ Testing
test-local: ## Test complete local workflow
	@echo "$(BLUE)Testing local workflow...$(NC)"
	@chmod +x .github/scripts/test-workflow.sh
	@./.github/scripts/test-workflow.sh

##@ Utilities
info: ## Show project information
	@echo "$(GREEN)Project Information$(NC)"
	@echo "  Node version: $$(node --version)"
	@echo "  npm version: $$(npm --version)"
	@echo "  Nginx version: $$(nginx -v 2>&1 | cut -d' ' -f3)"
	@echo ""
	@echo "$(GREEN)Configuration$(NC)"
	@echo "  Deploy directory: $(DEPLOY_DIR)"
	@echo "  Port: $(PORT)"
	@echo "  Frontend URL: http://localhost:$(PORT)"

status: ## Show deployment status
	@echo "$(GREEN)Deployment Status$(NC)"
	@echo ""
	@echo "$(BLUE)PM2 Status:$(NC)"
	@pm2 status || echo "  PM2 not running"
	@echo ""
	@echo "$(BLUE)Frontend Process:$(NC)"
	@pm2 info aladin-frontend-prod 2>/dev/null || echo "  Frontend not running"
	@echo ""
	@echo "$(BLUE)Health Check:$(NC)"
	@curl -f http://localhost:$(PORT)/ 2>/dev/null && echo "  ✓ Frontend is accessible" || echo "  ✗ Frontend not accessible"

cleanup: ## Cleanup old deployments
	@echo "$(BLUE)Cleaning up old deployments...$(NC)"
	@sudo find $(DEPLOY_DIR)/backup-* -type d -mtime +7 -exec rm -rf {} \; 2>/dev/null || true
	@npm cache clean --force 2>/dev/null || true
	@echo "$(GREEN)✓ Cleanup completed$(NC)"

##@ CI/CD
ci-build: install type-check build ## Run CI build process
	@echo "$(GREEN)✓ CI build completed$(NC)"

ci-test: ci-build test-local ## Run CI test process
	@echo "$(GREEN)✓ CI test completed$(NC)"

##@ Environment
env-setup: ## Setup environment files
	@echo "$(BLUE)Setting up environment files...$(NC)"
	@if [ ! -f ".env.local" ]; then \
		cp .env.example .env.local; \
		echo "$(GREEN)✓ Created .env.local from template$(NC)"; \
		echo "$(YELLOW)⚠️  Please edit .env.local to customize your settings$(NC)"; \
	else \
		echo "$(YELLOW).env.local already exists$(NC)"; \
	fi

env-check: ## Check environment variables
	@echo "$(BLUE)Environment Variables:$(NC)"
	@echo "  Files:"
	@ls -la .env* 2>/dev/null || echo "  No .env files found"
	@echo ""
	@echo "  Current NODE_ENV: $${NODE_ENV:-not set}"
	@echo "  VITE_API_URL: $${VITE_API_URL:-not set}"
	@echo "  VITE_SOCKET_URL: $${VITE_SOCKET_URL:-not set}"

##@ Setup
setup: install env-setup pm2-check ## Initial setup
	@echo "$(GREEN)╔════════════════════════════════════════╗$(NC)"
	@echo "$(GREEN)║  Setup completed successfully! 🎉      ║$(NC)"
	@echo "$(GREEN)╚════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Edit .env.local: $(BLUE)nano .env.local$(NC)"
	@echo "  2. Run dev server: $(BLUE)make dev$(NC) or $(BLUE)make pm2-dev$(NC)"
	@echo "  3. Build project: $(BLUE)make build$(NC)"
	@echo "  4. Deploy with PM2: $(BLUE)make deploy$(NC)"
	@echo ""
	@echo "PM2 Commands:"
	@echo "  - Status: $(BLUE)make pm2-status$(NC)"
	@echo "  - Logs: $(BLUE)make pm2-logs$(NC)"
	@echo "  - Restart: $(BLUE)make pm2-restart$(NC)"
	@echo ""
	@echo "For more commands: $(BLUE)make help$(NC)"

pm2-check: ## Check and install PM2 if needed
	@if ! command -v pm2 &> /dev/null; then \
		echo "$(YELLOW)PM2 not found, installing...$(NC)"; \
		npm install -g pm2; \
		echo "$(GREEN)✓ PM2 installed$(NC)"; \
	else \
		echo "$(GREEN)✓ PM2 already installed: $$(pm2 --version)$(NC)"; \
	fi
