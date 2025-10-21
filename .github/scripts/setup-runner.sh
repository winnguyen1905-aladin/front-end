#!/bin/bash

###############################################################################
# GitHub Actions Self-hosted Runner Setup Script
# For Aladin Front-end Repository
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
RUNNER_VERSION="2.329.0"
REPO_URL="https://github.com/winuguyen1905-aladin/front-end"
RUNNER_DIR="${HOME}/actions-runner-frontend"
DOCKER_NETWORK="aladin-network"

echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Aladin Front-end - GitHub Runner Setup Script        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}✗ This script should NOT be run as root${NC}"
   echo "  Runner should run under a regular user account"
   exit 1
fi

# Detect OS
OS=$(uname -s)
ARCH=$(uname -m)

echo -e "${YELLOW}📋 System Information:${NC}"
echo "  OS: $OS"
echo "  Architecture: $ARCH"
echo ""

# Function to download runner
download_runner() {
    echo -e "${YELLOW}📥 Downloading GitHub Actions Runner...${NC}"
    
    mkdir -p "$RUNNER_DIR"
    cd "$RUNNER_DIR"
    
    if [[ "$OS" == "Linux" ]]; then
        RUNNER_FILE="actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
        RUNNER_URL="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${RUNNER_FILE}"
    elif [[ "$OS" == "Darwin" ]]; then
        RUNNER_FILE="actions-runner-osx-x64-${RUNNER_VERSION}.tar.gz"
        RUNNER_URL="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${RUNNER_FILE}"
    else
        echo -e "${RED}✗ Unsupported OS: $OS${NC}"
        exit 1
    fi
    
    if [ -f "$RUNNER_FILE" ]; then
        echo "  Runner package already exists, skipping download..."
    else
        curl -o "$RUNNER_FILE" -L "$RUNNER_URL"
        echo -e "${GREEN}✓ Download completed${NC}"
    fi
    
    echo -e "${YELLOW}📦 Extracting runner...${NC}"
    tar xzf "./$RUNNER_FILE"
    echo -e "${GREEN}✓ Extraction completed${NC}"
}

# Function to install dependencies
install_dependencies() {
    echo -e "${YELLOW}📦 Checking dependencies...${NC}"
    
    # Check for required tools
    MISSING_DEPS=()
    
    command -v docker >/dev/null 2>&1 || MISSING_DEPS+=("docker")
    command -v curl >/dev/null 2>&1 || MISSING_DEPS+=("curl")
    command -v node >/dev/null 2>&1 || MISSING_DEPS+=("node")
    
    if [ ${#MISSING_DEPS[@]} -ne 0 ]; then
        echo -e "${RED}✗ Missing dependencies: ${MISSING_DEPS[*]}${NC}"
        echo ""
        echo "Please install missing dependencies:"
        echo "  - Docker: https://docs.docker.com/get-docker/"
        echo "  - Node.js: https://nodejs.org/"
        exit 1
    fi
    
    echo -e "${GREEN}✓ All dependencies installed${NC}"
    echo "  - Docker: $(docker --version)"
    echo "  - Node.js: $(node --version)"
    echo "  - npm: $(npm --version)"
}

# Function to setup Docker network
setup_docker_network() {
    echo -e "${YELLOW}🐳 Setting up Docker network...${NC}"
    
    if docker network ls | grep -q "$DOCKER_NETWORK"; then
        echo "  Network '$DOCKER_NETWORK' already exists"
    else
        docker network create "$DOCKER_NETWORK"
        echo -e "${GREEN}✓ Network '$DOCKER_NETWORK' created${NC}"
    fi
}

# Function to configure runner
configure_runner() {
    echo ""
    echo -e "${YELLOW}⚙️  Configuring GitHub Runner...${NC}"
    echo ""
    echo "To complete setup, you need a registration token from GitHub:"
    echo "  1. Go to: ${REPO_URL}/settings/actions/runners/new"
    echo "  2. Copy the token shown"
    echo "  3. Paste it below"
    echo ""
    read -p "Enter GitHub Runner Token: " RUNNER_TOKEN
    
    if [ -z "$RUNNER_TOKEN" ]; then
        echo -e "${RED}✗ Token cannot be empty${NC}"
        exit 1
    fi
    
    cd "$RUNNER_DIR"
    
    echo ""
    read -p "Enter runner name (default: frontend-runner): " RUNNER_NAME
    RUNNER_NAME=${RUNNER_NAME:-frontend-runner}
    
    ./config.sh \
        --url "$REPO_URL" \
        --token "$RUNNER_TOKEN" \
        --name "$RUNNER_NAME" \
        --work _work \
        --labels frontend,docker,self-hosted
    
    echo -e "${GREEN}✓ Runner configured successfully${NC}"
}

# Function to install as service
install_service() {
    echo ""
    read -p "Install runner as a service? (y/n): " INSTALL_SERVICE
    
    if [[ "$INSTALL_SERVICE" =~ ^[Yy]$ ]]; then
        cd "$RUNNER_DIR"
        sudo ./svc.sh install
        sudo ./svc.sh start
        echo -e "${GREEN}✓ Runner service installed and started${NC}"
        echo ""
        echo "Service commands:"
        echo "  Status: sudo ./svc.sh status"
        echo "  Stop:   sudo ./svc.sh stop"
        echo "  Start:  sudo ./svc.sh start"
    else
        echo ""
        echo "To run the runner manually:"
        echo "  cd $RUNNER_DIR"
        echo "  ./run.sh"
    fi
}

# Function to verify installation
verify_installation() {
    echo ""
    echo -e "${YELLOW}🔍 Verifying installation...${NC}"
    
    cd "$RUNNER_DIR"
    
    if [ -f ".runner" ]; then
        echo -e "${GREEN}✓ Runner configured${NC}"
    else
        echo -e "${RED}✗ Runner not configured${NC}"
        return 1
    fi
    
    if docker network ls | grep -q "$DOCKER_NETWORK"; then
        echo -e "${GREEN}✓ Docker network ready${NC}"
    else
        echo -e "${RED}✗ Docker network not found${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ Installation verified${NC}"
}

# Function to show next steps
show_next_steps() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  Setup Completed Successfully! 🎉                      ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Verify runner status:"
    echo "   Go to: ${REPO_URL}/settings/actions/runners"
    echo "   Your runner should appear with status 'Idle' (green)"
    echo ""
    echo "2. Test the workflow:"
    echo "   - Push code to trigger CI/CD"
    echo "   - Or manually trigger from Actions tab"
    echo ""
    echo "3. Monitor the runner:"
    echo "   - Check logs: journalctl -u actions.runner.* -f"
    echo "   - Or if running manually: check terminal output"
    echo ""
    echo "4. Documentation:"
    echo "   - Workflow docs: .github/workflows/README.md"
    echo "   - GitHub Actions: https://docs.github.com/actions"
    echo ""
}

# Main execution
main() {
    echo -e "${YELLOW}Starting setup process...${NC}"
    echo ""
    
    install_dependencies
    echo ""
    
    download_runner
    echo ""
    
    setup_docker_network
    echo ""
    
    configure_runner
    echo ""
    
    install_service
    echo ""
    
    verify_installation
    
    show_next_steps
}

# Run main function
main

exit 0

