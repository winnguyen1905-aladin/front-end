#!/bin/bash

###############################################################################
# GitHub Actions Self-hosted Runner Setup Script
# For Aladin Front-end Repository (Nginx deployment)
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

echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Aladin Front-end - GitHub Runner Setup Script        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}✗ This script should NOT be run as root${NC}"
   echo "  Runner should run under a regular user account with sudo access"
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
    
    command -v curl >/dev/null 2>&1 || MISSING_DEPS+=("curl")
    command -v node >/dev/null 2>&1 || MISSING_DEPS+=("node")
    command -v nginx >/dev/null 2>&1 || MISSING_DEPS+=("nginx")
    
    if [ ${#MISSING_DEPS[@]} -ne 0 ]; then
        echo -e "${YELLOW}⚠️  Missing dependencies: ${MISSING_DEPS[*]}${NC}"
        echo ""
        echo "Installing missing dependencies..."
        
        # Install missing packages
        for dep in "${MISSING_DEPS[@]}"; do
            case $dep in
                "nginx")
                    echo "Installing nginx..."
                    sudo apt update && sudo apt install -y nginx
                    ;;
                "node")
                    echo -e "${RED}✗ Node.js not found${NC}"
                    echo "Please install Node.js: https://nodejs.org/"
                    exit 1
                    ;;
                "curl")
                    sudo apt update && sudo apt install -y curl
                    ;;
            esac
        done
    fi
    
    echo -e "${GREEN}✓ All dependencies ready${NC}"
    echo "  - Node.js: $(node --version)"
    echo "  - npm: $(npm --version)"
    echo "  - Nginx: $(nginx -v 2>&1 | cut -d' ' -f3)"
}

# Function to setup nginx
setup_nginx() {
    echo -e "${YELLOW}🌐 Setting up Nginx...${NC}"
    
    # Create deployment directory
    sudo mkdir -p /var/www/aladin-frontend
    sudo chown -R www-data:www-data /var/www/aladin-frontend
    sudo chmod -R 755 /var/www/aladin-frontend
    
    # Enable and start nginx
    sudo systemctl enable nginx
    sudo systemctl start nginx
    
    echo -e "${GREEN}✓ Nginx setup completed${NC}"
    echo "  - Status: $(sudo systemctl is-active nginx)"
    echo "  - Deploy directory: /var/www/aladin-frontend"
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
    
    if sudo systemctl is-active --quiet nginx; then
        echo -e "${GREEN}✓ Nginx is running${NC}"
    else
        echo -e "${RED}✗ Nginx not running${NC}"
        return 1
    fi
    
    if [ -d "/var/www/aladin-frontend" ]; then
        echo -e "${GREEN}✓ Deploy directory ready${NC}"
    else
        echo -e "${RED}✗ Deploy directory not found${NC}"
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
    echo "3. Monitor the deployment:"
    echo "   - Frontend: http://localhost:3000"
    echo "   - Health: http://localhost:3000/health"
    echo "   - Nginx status: sudo systemctl status nginx"
    echo ""
    echo "4. Check logs:"
    echo "   - Runner: journalctl -u actions.runner.* -f"
    echo "   - Nginx: sudo tail -f /var/log/nginx/error.log"
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
    
    setup_nginx
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

