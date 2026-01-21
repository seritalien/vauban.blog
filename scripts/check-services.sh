#!/usr/bin/env bash
# =============================================================================
# Vauban Blog - Service Health Check Script
# =============================================================================
# Checks if all required services are running and healthy.
# Returns exit code 0 if all services are healthy, 1 otherwise.
# =============================================================================

set -e

# -----------------------------------------------------------------------------
# Color definitions
# -----------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# -----------------------------------------------------------------------------
# Track overall health status
# -----------------------------------------------------------------------------
ALL_HEALTHY=true

# -----------------------------------------------------------------------------
# Helper functions
# -----------------------------------------------------------------------------
print_status() {
    local name=$1
    local status=$2
    local details=$3

    if [ "$status" = "healthy" ]; then
        echo -e "  ${GREEN}[OK]${NC} ${BOLD}$name${NC} - $details"
    elif [ "$status" = "starting" ]; then
        echo -e "  ${YELLOW}[STARTING]${NC} ${BOLD}$name${NC} - $details"
    else
        echo -e "  ${RED}[DOWN]${NC} ${BOLD}$name${NC} - $details"
        ALL_HEALTHY=false
    fi
}

print_header() {
    echo ""
    echo -e "${CYAN}${BOLD}Vauban Blog - Service Health Check${NC}"
    echo -e "${CYAN}=====================================${NC}"
    echo ""
}

# -----------------------------------------------------------------------------
# Check Docker
# -----------------------------------------------------------------------------
check_docker() {
    echo -e "${BLUE}Checking Docker...${NC}"

    if ! command -v docker &> /dev/null; then
        print_status "Docker" "down" "Not installed"
        return
    fi

    if ! docker info &> /dev/null; then
        print_status "Docker" "down" "Daemon not running"
        return
    fi

    print_status "Docker" "healthy" "Daemon running"
}

# -----------------------------------------------------------------------------
# Check Redis
# -----------------------------------------------------------------------------
check_redis() {
    echo -e "\n${BLUE}Checking Redis...${NC}"

    # Check if container exists and is running
    if ! docker ps --format '{{.Names}}' | grep -q '^vauban-redis$'; then
        print_status "Redis" "down" "Container not running"
        return
    fi

    # Check health
    if docker exec vauban-redis redis-cli ping &> /dev/null; then
        local info=$(docker exec vauban-redis redis-cli info server 2>/dev/null | grep redis_version | cut -d: -f2 | tr -d '\r')
        print_status "Redis" "healthy" "Version $info on port 6379"
    else
        print_status "Redis" "down" "Not responding to ping"
    fi
}

# -----------------------------------------------------------------------------
# Check IPFS
# -----------------------------------------------------------------------------
check_ipfs() {
    echo -e "\n${BLUE}Checking IPFS...${NC}"

    # Check if container exists and is running
    if ! docker ps --format '{{.Names}}' | grep -q '^vauban-ipfs$'; then
        print_status "IPFS" "down" "Container not running"
        return
    fi

    # Check API health
    if curl -s --max-time 5 http://localhost:5001/api/v0/id &> /dev/null; then
        local peer_id=$(curl -s http://localhost:5001/api/v0/id 2>/dev/null | grep -o '"ID":"[^"]*"' | cut -d'"' -f4 | head -c 20)
        print_status "IPFS" "healthy" "Peer ID: ${peer_id}... (API: 5001, Gateway: 8005)"
    else
        # Check if it's still starting
        local health=$(docker inspect --format='{{.State.Health.Status}}' vauban-ipfs 2>/dev/null || echo "unknown")
        if [ "$health" = "starting" ]; then
            print_status "IPFS" "starting" "Container is initializing..."
        else
            print_status "IPFS" "down" "API not responding"
        fi
    fi
}

# -----------------------------------------------------------------------------
# Check Madara L3
# -----------------------------------------------------------------------------
check_madara() {
    echo -e "\n${BLUE}Checking Madara L3...${NC}"

    # Check if container exists and is running
    if ! docker ps --format '{{.Names}}' | grep -q '^vauban-madara-l3$'; then
        print_status "Madara L3" "down" "Container not running"
        return
    fi

    # Check RPC health
    if curl -s --max-time 5 http://localhost:9944/health &> /dev/null; then
        # Try to get chain ID
        local chain_id=$(curl -s --max-time 5 -X POST -H "Content-Type: application/json" \
            -d '{"jsonrpc":"2.0","method":"starknet_chainId","params":[],"id":1}' \
            http://localhost:9944 2>/dev/null | grep -o '"result":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
        print_status "Madara L3" "healthy" "Chain ID: $chain_id (RPC: 9944, WS: 9945)"
    else
        # Check if it's still starting
        local health=$(docker inspect --format='{{.State.Health.Status}}' vauban-madara-l3 2>/dev/null || echo "unknown")
        if [ "$health" = "starting" ]; then
            print_status "Madara L3" "starting" "Container is initializing (may take 1-2 minutes)..."
        else
            print_status "Madara L3" "down" "RPC not responding"
        fi
    fi
}

# -----------------------------------------------------------------------------
# Check Frontend (optional)
# -----------------------------------------------------------------------------
check_frontend() {
    echo -e "\n${BLUE}Checking Frontend...${NC}"

    if curl -s --max-time 2 http://localhost:3005 &> /dev/null; then
        print_status "Frontend" "healthy" "Running on http://localhost:3005"
    else
        print_status "Frontend" "down" "Not running (start with: pnpm dev)"
    fi
}

# -----------------------------------------------------------------------------
# Print summary
# -----------------------------------------------------------------------------
print_summary() {
    echo ""
    echo -e "${CYAN}=====================================${NC}"

    if [ "$ALL_HEALTHY" = true ]; then
        echo -e "${GREEN}${BOLD}All services are healthy!${NC}"
        echo ""
        echo -e "  ${CYAN}Frontend:${NC}     http://localhost:3005"
        echo -e "  ${CYAN}Madara RPC:${NC}   http://localhost:9944"
        echo -e "  ${CYAN}IPFS API:${NC}     http://localhost:5001"
        echo -e "  ${CYAN}IPFS Gateway:${NC} http://localhost:8005"
        echo -e "  ${CYAN}Redis:${NC}        localhost:6379"
    else
        echo -e "${YELLOW}${BOLD}Some services need attention.${NC}"
        echo ""
        echo -e "  To start services: ${CYAN}pnpm dev:services${NC}"
        echo -e "  To view logs:      ${CYAN}pnpm docker:logs${NC}"
    fi
    echo ""
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
    print_header
    check_docker
    check_redis
    check_ipfs
    check_madara
    check_frontend
    print_summary

    if [ "$ALL_HEALTHY" = true ]; then
        exit 0
    else
        exit 1
    fi
}

main "$@"
