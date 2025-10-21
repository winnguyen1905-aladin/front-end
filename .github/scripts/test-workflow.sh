#!/bin/bash

###############################################################################
# Test Frontend Workflow Locally
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
TEST_DIR="/tmp/aladin-frontend-test"
TEST_PORT="3333"

echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Testing Frontend Workflow Locally                     ║${NC}"
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

# Step 6: Setup test environment
echo -e "${BLUE}Step 6: Setting up test environment...${NC}"
sudo mkdir -p "$TEST_DIR"
sudo cp -r dist "$TEST_DIR/"
sudo chown -R www-data:www-data "$TEST_DIR"
echo -e "${GREEN}✓ Test environment ready${NC}"
echo ""

# Step 7: Configure test nginx
echo -e "${BLUE}Step 7: Configuring test nginx...${NC}"
sudo tee /etc/nginx/sites-available/aladin-frontend-test > /dev/null <<EOF
server {
    listen $TEST_PORT;
    server_name localhost;
    root $TEST_DIR/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/aladin-frontend-test /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
echo -e "${GREEN}✓ Test nginx configured${NC}"
echo ""

# Step 8: Wait for nginx to be ready
echo -e "${BLUE}Step 8: Waiting for nginx to be ready...${NC}"
sleep 3

# Step 9: Verify deployment
echo -e "${BLUE}Step 9: Verifying deployment...${NC}"

# Check nginx is running
if ! sudo systemctl is-active --quiet nginx; then
    echo -e "${RED}✗ Nginx is not running${NC}"
    sudo systemctl status nginx
    exit 1
fi

# Check health endpoint
echo "  Testing health endpoint..."
if curl -f "http://localhost:$TEST_PORT/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
    sudo nginx -T
    sudo journalctl -u nginx --no-pager -n 10
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

# Step 10: Show deployment info
echo -e "${BLUE}Step 10: Deployment information...${NC}"
echo ""
echo "Nginx Status:"
sudo systemctl status nginx --no-pager
echo ""
echo "Test files:"
ls -la "$TEST_DIR/dist/"
echo ""

# Summary
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  All Tests Passed! 🎉                                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Application is running at: http://localhost:$TEST_PORT"
echo ""
echo "Useful commands:"
echo "  View nginx logs: sudo tail -f /var/log/nginx/access.log"
echo "  View error logs: sudo tail -f /var/log/nginx/error.log"
echo "  Nginx status:    sudo systemctl status nginx"
echo "  Reload nginx:    sudo systemctl reload nginx"
echo ""
echo "To cleanup:"
echo "  sudo rm /etc/nginx/sites-enabled/aladin-frontend-test"
echo "  sudo rm /etc/nginx/sites-available/aladin-frontend-test"
echo "  sudo rm -rf $TEST_DIR"
echo "  sudo systemctl reload nginx"
echo ""

read -p "Press Enter to view nginx logs (Ctrl+C to exit)..."
sudo tail -f /var/log/nginx/access.log

