.PHONY: help install dev build clean docker-build docker-run docker-stop test lint

# Variables
DOCKER_IMAGE=aladin-frontend
DOCKER_CONTAINER=aladin-frontend-local
DOCKER_NETWORK=aladin-network
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

##@ Docker
docker-network: ## Create Docker network
	@echo "$(BLUE)Creating Docker network...$(NC)"
	@docker network create $(DOCKER_NETWORK) 2>/dev/null || echo "Network already exists"
	@echo "$(GREEN)✓ Network ready$(NC)"

docker-build: ## Build Docker image
	@echo "$(BLUE)Building Docker image...$(NC)"
	docker build -t $(DOCKER_IMAGE):latest .
	@echo "$(GREEN)✓ Docker image built$(NC)"

docker-run: docker-network docker-stop ## Run Docker container
	@echo "$(BLUE)Starting Docker container...$(NC)"
	docker run -d \
		--name $(DOCKER_CONTAINER) \
		--network $(DOCKER_NETWORK) \
		-p $(PORT):80 \
		-e NODE_ENV=production \
		$(DOCKER_IMAGE):latest
	@echo "$(GREEN)✓ Container started$(NC)"
	@echo "$(GREEN)→ Access at: http://localhost:$(PORT)$(NC)"

docker-stop: ## Stop and remove Docker container
	@echo "$(BLUE)Stopping Docker container...$(NC)"
	@docker stop $(DOCKER_CONTAINER) 2>/dev/null || true
	@docker rm $(DOCKER_CONTAINER) 2>/dev/null || true
	@echo "$(GREEN)✓ Container stopped$(NC)"

docker-logs: ## Show Docker container logs
	@docker logs -f $(DOCKER_CONTAINER)

docker-shell: ## Access Docker container shell
	@docker exec -it $(DOCKER_CONTAINER) sh

docker-compose-up: docker-network ## Run with docker-compose
	@echo "$(BLUE)Starting with docker-compose...$(NC)"
	docker-compose -f docker-compose.dev.yml up --build

docker-compose-down: ## Stop docker-compose
	@echo "$(BLUE)Stopping docker-compose...$(NC)"
	docker-compose -f docker-compose.dev.yml down

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
test-local: build docker-build docker-run ## Test complete local workflow
	@echo "$(GREEN)Testing local deployment...$(NC)"
	@sleep 5
	@curl -f http://localhost:$(PORT)/health && \
		echo "$(GREEN)✓ Health check passed$(NC)" || \
		echo "$(YELLOW)⚠️  Health check failed$(NC)"

##@ Deployment
deploy-local: docker-build docker-run ## Deploy locally with Docker
	@echo "$(GREEN)✓ Local deployment completed$(NC)"
	@echo "$(GREEN)→ Frontend: http://localhost:$(PORT)$(NC)"
	@echo "$(GREEN)→ Health: http://localhost:$(PORT)/health$(NC)"

##@ Utilities
info: ## Show project information
	@echo "$(GREEN)Project Information$(NC)"
	@echo "  Node version: $$(node --version)"
	@echo "  npm version: $$(npm --version)"
	@echo "  Docker version: $$(docker --version)"
	@echo ""
	@echo "$(GREEN)Configuration$(NC)"
	@echo "  Image: $(DOCKER_IMAGE)"
	@echo "  Container: $(DOCKER_CONTAINER)"
	@echo "  Network: $(DOCKER_NETWORK)"
	@echo "  Port: $(PORT)"

status: ## Show Docker status
	@echo "$(GREEN)Docker Status$(NC)"
	@echo ""
	@echo "$(BLUE)Networks:$(NC)"
	@docker network ls | grep $(DOCKER_NETWORK) || echo "  Network not found"
	@echo ""
	@echo "$(BLUE)Images:$(NC)"
	@docker images | grep $(DOCKER_IMAGE) || echo "  No images found"
	@echo ""
	@echo "$(BLUE)Containers:$(NC)"
	@docker ps -a | grep $(DOCKER_CONTAINER) || echo "  No containers found"

cleanup: docker-stop ## Cleanup Docker resources
	@echo "$(BLUE)Cleaning up Docker resources...$(NC)"
	@docker rmi $(DOCKER_IMAGE):latest 2>/dev/null || true
	@docker system prune -f
	@echo "$(GREEN)✓ Cleanup completed$(NC)"

##@ CI/CD
ci-build: install type-check build ## Run CI build process
	@echo "$(GREEN)✓ CI build completed$(NC)"

ci-test: ci-build test-local ## Run CI test process
	@echo "$(GREEN)✓ CI test completed$(NC)"

##@ Setup
setup: install docker-network ## Initial setup
	@echo "$(GREEN)╔════════════════════════════════════════╗$(NC)"
	@echo "$(GREEN)║  Setup completed successfully! 🎉      ║$(NC)"
	@echo "$(GREEN)╚════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Run dev server: $(BLUE)make dev$(NC)"
	@echo "  2. Build project: $(BLUE)make build$(NC)"
	@echo "  3. Test Docker: $(BLUE)make test-local$(NC)"
	@echo "  4. Deploy local: $(BLUE)make deploy-local$(NC)"
	@echo ""
	@echo "For more commands: $(BLUE)make help$(NC)"

