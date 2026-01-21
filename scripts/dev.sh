#!/usr/bin/env bash
# =============================================================================
# Vauban Blog - Full Development Environment Startup Script
# =============================================================================
# This script starts all services needed for local development:
# - Docker services (Madara L3, Redis, IPFS)
# - Frontend dev server (Next.js)
# =============================================================================

set -e

# -----------------------------------------------------------------------------
# Color definitions
# -----------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# -----------------------------------------------------------------------------
# Script directory (for relative paths)
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# -----------------------------------------------------------------------------
# Helper functions
# -----------------------------------------------------------------------------
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "\n${MAGENTA}${BOLD}==>${NC} ${BOLD}$1${NC}"
}

print_banner() {
    echo -e "${CYAN}"
    echo "  _   __            __              "
    echo " | | / /__ _ __  __/ /  ___ _ ___  "
    echo " | |/ / _ \`/ _ \|/ _ | / _ \`/ _ \ "
    echo " |___/\_,_/\_,_/|_,_|_/\_,_/_//_/ "
    echo "                                    "
    echo -e "${NC}${BOLD}  Decentralized Blog Platform${NC}"
    echo ""
}

# -----------------------------------------------------------------------------
# Check prerequisites
# -----------------------------------------------------------------------------
check_docker() {
    log_step "Checking Docker"

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        log_info "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running."
        log_info "Please start Docker Desktop or the Docker service."
        exit 1
    fi

    log_success "Docker is installed and running"
}

check_docker_compose() {
    # Check for docker compose (V2) first, then docker-compose (V1)
    if docker compose version &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
    elif command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    else
        log_error "Docker Compose is not installed."
        log_info "Please install Docker Compose."
        exit 1
    fi
    log_success "Docker Compose is available ($DOCKER_COMPOSE)"
}

check_node() {
    log_step "Checking Node.js"

    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js >= 20."
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 20 ]; then
        log_error "Node.js version must be >= 20. Current: $(node -v)"
        exit 1
    fi

    log_success "Node.js $(node -v) installed"
}

check_pnpm() {
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is not installed. Please install pnpm >= 8."
        log_info "Run: npm install -g pnpm"
        exit 1
    fi
    log_success "pnpm $(pnpm -v) installed"
}

# -----------------------------------------------------------------------------
# Start Docker services
# -----------------------------------------------------------------------------
start_docker_services() {
    log_step "Starting Docker services"

    cd "$PROJECT_ROOT/docker"

    # Check if services are already running
    RUNNING_CONTAINERS=$($DOCKER_COMPOSE ps -q 2>/dev/null | wc -l)

    if [ "$RUNNING_CONTAINERS" -gt 0 ]; then
        log_warning "Some containers are already running"
        log_info "Restarting services..."
        $DOCKER_COMPOSE down
    fi

    log_info "Starting Madara L3, Redis, and IPFS..."
    $DOCKER_COMPOSE up -d

    log_success "Docker services started"
}

# -----------------------------------------------------------------------------
# Wait for services to be healthy
# -----------------------------------------------------------------------------
wait_for_services() {
    log_step "Waiting for services to be healthy"

    local max_attempts=60
    local attempt=1

    # Wait for Redis
    log_info "Waiting for Redis..."
    while [ $attempt -le $max_attempts ]; do
        if docker exec vauban-redis redis-cli ping &> /dev/null; then
            log_success "Redis is healthy"
            break
        fi
        if [ $attempt -eq $max_attempts ]; then
            log_error "Redis failed to start within timeout"
            exit 1
        fi
        echo -n "."
        sleep 1
        ((attempt++))
    done

    # Wait for IPFS
    attempt=1
    log_info "Waiting for IPFS..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:5001/api/v0/id &> /dev/null; then
            log_success "IPFS is healthy"
            break
        fi
        if [ $attempt -eq $max_attempts ]; then
            log_error "IPFS failed to start within timeout"
            exit 1
        fi
        echo -n "."
        sleep 1
        ((attempt++))
    done

    # Wait for Madara (takes longer to start)
    attempt=1
    log_info "Waiting for Madara L3 (this may take up to 2 minutes on first start)..."
    local madara_max_attempts=120
    while [ $attempt -le $madara_max_attempts ]; do
        if curl -s http://localhost:9944/health &> /dev/null; then
            log_success "Madara L3 is healthy"
            break
        fi
        if [ $attempt -eq $madara_max_attempts ]; then
            log_warning "Madara is still starting. It may take a few more minutes."
            log_info "Check logs with: docker logs -f vauban-madara-l3"
            break
        fi
        echo -n "."
        sleep 2
        ((attempt++))
    done

    echo ""
}

# -----------------------------------------------------------------------------
# Install dependencies if needed
# -----------------------------------------------------------------------------
install_deps() {
    log_step "Checking dependencies"

    cd "$PROJECT_ROOT"

    if [ ! -d "node_modules" ]; then
        log_info "Installing dependencies..."
        pnpm install
        log_success "Dependencies installed"
    else
        log_success "Dependencies already installed"
    fi
}

# -----------------------------------------------------------------------------
# Start frontend
# -----------------------------------------------------------------------------
start_frontend() {
    log_step "Starting frontend dev server"

    cd "$PROJECT_ROOT"

    echo ""
    echo -e "${GREEN}${BOLD}============================================${NC}"
    echo -e "${GREEN}${BOLD}  Vauban Blog Development Environment${NC}"
    echo -e "${GREEN}${BOLD}============================================${NC}"
    echo ""
    echo -e "  ${CYAN}Frontend:${NC}    http://localhost:3005"
    echo -e "  ${CYAN}Madara RPC:${NC}  http://localhost:9944"
    echo -e "  ${CYAN}IPFS API:${NC}    http://localhost:5001"
    echo -e "  ${CYAN}IPFS Gateway:${NC} http://localhost:8005"
    echo -e "  ${CYAN}Redis:${NC}       localhost:6379"
    echo ""
    echo -e "  ${YELLOW}Logs:${NC}"
    echo -e "    docker logs -f vauban-madara-l3"
    echo -e "    docker logs -f vauban-ipfs"
    echo -e "    docker logs -f vauban-redis"
    echo ""
    echo -e "  ${YELLOW}Stop services:${NC}"
    echo -e "    pnpm docker:down"
    echo ""
    echo -e "${GREEN}${BOLD}============================================${NC}"
    echo ""

    # Start the frontend
    pnpm --filter frontend dev
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
    print_banner

    check_docker
    check_docker_compose
    check_node
    check_pnpm

    start_docker_services
    wait_for_services
    install_deps
    start_frontend
}

# Handle Ctrl+C gracefully
trap 'echo -e "\n${YELLOW}Shutting down... (Docker services will keep running)${NC}"; exit 0' INT

main "$@"
