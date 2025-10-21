#!/bin/bash

###############################################################################
# Test Workflow Locally
# Simulates GitHub Actions workflow steps locally for debugging
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NODE_VERSION="18"
DOCKER_IMAGE="aladin-frontend-test"
DOCKER_CONTAINER="aladin-frontend-test-container"
DOCKER_NETWORK="aladin-network"
TEST_PORT="3333"

echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Testing Workflow Locally                              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Change to project directory
cd "$PROJECT_DIR"

# Step 1: Check environment
echo -e "${BLUE}Step 1: Checking environment...${NC}"
echo "  Node version: $(node --version)"
echo "  npm version: $(npm --version)"
echo "  Docker version: $(docker --version)"

CURRENT_NODE=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$CURRENT_NODE" -lt "$NODE_VERSION" ]; then
    echo -e "${RED}✗ Node.js version must be $NODE_VERSION or higher${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Environment check passed${NC}"
echo ""

# Step 2: Install dependencies
echo -e "${BLUE}Step 2: Installing dependencies...${NC}"
npm ci
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Step 3: Type check
echo -e "${BLUE}Step 3: Type checking...${NC}"
npx tsc --noEmit
echo -e "${GREEN}✓ Type check passed${NC}"
echo ""

# Step 4: Build application
echo -e "${BLUE}Step 4: Building application...${NC}"
npm run build
echo -e "${GREEN}✓ Build completed${NC}"
echo ""

# Step 5: Verify build artifacts
echo -e "${BLUE}Step 5: Verifying build artifacts...${NC}"
if [ ! -d "dist" ]; then
    echo -e "${RED}✗ dist folder not found${NC}"
    exit 1
fi

if [ ! -f "dist/index.html" ]; then
    echo -e "${RED}✗ index.html not found in dist${NC}"
    exit 1
fi

echo "  dist folder size: $(du -sh dist | cut -f1)"
echo "  Files in dist:"
ls -lh dist/
echo -e "${GREEN}✓ Build artifacts verified${NC}"
echo ""

# Step 6: Create Docker network
echo -e "${BLUE}Step 6: Setting up Docker network...${NC}"
docker network create "$DOCKER_NETWORK" 2>/dev/null || echo "  Network already exists"
echo -e "${GREEN}✓ Docker network ready${NC}"
echo ""

# Step 7: Build Docker image
echo -e "${BLUE}Step 7: Building Docker image...${NC}"
docker build -t "$DOCKER_IMAGE:latest" .
echo -e "${GREEN}✓ Docker image built${NC}"
echo ""

# Step 8: Stop old container if exists
echo -e "${BLUE}Step 8: Cleaning up old containers...${NC}"
docker stop "$DOCKER_CONTAINER" 2>/dev/null || true
docker rm "$DOCKER_CONTAINER" 2>/dev/null || true
echo -e "${GREEN}✓ Cleanup completed${NC}"
echo ""

# Step 9: Run container
echo -e "${BLUE}Step 9: Starting container...${NC}"
docker run -d \
    --name "$DOCKER_CONTAINER" \
    --network "$DOCKER_NETWORK" \
    -p "$TEST_PORT:80" \
    -e NODE_ENV=test \
    "$DOCKER_IMAGE:latest"

echo -e "${GREEN}✓ Container started${NC}"
echo ""

# Step 10: Wait for container to be ready
echo -e "${BLUE}Step 10: Waiting for container to be ready...${NC}"
sleep 5

# Step 11: Verify deployment
echo -e "${BLUE}Step 11: Verifying deployment...${NC}"

# Check if container is running
if ! docker ps | grep -q "$DOCKER_CONTAINER"; then
    echo -e "${RED}✗ Container is not running${NC}"
    echo "Container logs:"
    docker logs "$DOCKER_CONTAINER"
    exit 1
fi

# Check health endpoint
echo "  Testing health endpoint..."
if curl -f "http://localhost:$TEST_PORT/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
    echo "Container logs:"
    docker logs "$DOCKER_CONTAINER"
    exit 1
fi

# Check main page
echo "  Testing main page..."
if curl -f "http://localhost:$TEST_PORT/" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Main page accessible${NC}"
else
    echo -e "${RED}✗ Main page not accessible${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Deployment verified${NC}"
echo ""

# Step 12: Show container info
echo -e "${BLUE}Step 12: Container information...${NC}"
echo ""
echo "Container Status:"
docker ps | grep "$DOCKER_CONTAINER"
echo ""
echo "Container Stats:"
docker stats "$DOCKER_CONTAINER" --no-stream
echo ""

# Summary
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  All Tests Passed! 🎉                                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Application is running at: http://localhost:$TEST_PORT"
echo ""
echo "Useful commands:"
echo "  View logs:    docker logs -f $DOCKER_CONTAINER"
echo "  Access shell: docker exec -it $DOCKER_CONTAINER sh"
echo "  Stop:         docker stop $DOCKER_CONTAINER"
echo "  Remove:       docker rm $DOCKER_CONTAINER"
echo ""
echo "To cleanup:"
echo "  docker stop $DOCKER_CONTAINER && docker rm $DOCKER_CONTAINER"
echo "  docker rmi $DOCKER_IMAGE:latest"
echo ""

read -p "Press Enter to view container logs (Ctrl+C to exit)..."
docker logs -f "$DOCKER_CONTAINER"

