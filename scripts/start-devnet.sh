#!/bin/bash
# Start Vauban Blog Madara L3 Devnet
# Usage: ./scripts/start-devnet.sh [--monitoring]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$PROJECT_ROOT/docker"

echo "🚀 Starting Vauban Blog Madara L3 Devnet..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Check if secrets directory exists and has required files
SECRETS_DIR="$DOCKER_DIR/secrets"
if [ ! -d "$SECRETS_DIR" ]; then
    echo "📁 Creating secrets directory..."
    mkdir -p "$SECRETS_DIR"

    echo "⚠️  Warning: Sepolia private key not found."
    echo "   Please create $SECRETS_DIR/sepolia_private_key.txt"
    echo "   Or disable auto-settlement in docker/madara/config.toml"
fi

# Parse arguments
COMPOSE_PROFILES=""
if [ "$1" == "--monitoring" ]; then
    echo "📊 Enabling monitoring (Prometheus + Grafana)..."
    COMPOSE_PROFILES="--profile monitoring"
fi

# Start services
cd "$DOCKER_DIR"
echo "🐳 Starting Docker services..."
docker compose up -d $COMPOSE_PROFILES

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check Madara health
MAX_RETRIES=30
RETRY_COUNT=0
until curl -s http://localhost:9944/health > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "❌ Madara failed to start after ${MAX_RETRIES} attempts"
        echo "📋 Showing Madara logs:"
        docker logs vauban-madara-l3 --tail 50
        exit 1
    fi
    echo "   Waiting for Madara... (attempt $RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

echo "✅ Madara L3 is running!"

# Check Redis
if ! docker exec vauban-redis redis-cli ping > /dev/null 2>&1; then
    echo "⚠️  Warning: Redis is not responding"
else
    echo "✅ Redis is running!"
fi

# Check IPFS
if ! curl -s http://localhost:5001/api/v0/id > /dev/null 2>&1; then
    echo "⚠️  Warning: IPFS is not responding"
else
    echo "✅ IPFS is running!"
fi

echo ""
echo "🎉 Devnet started successfully!"
echo ""
echo "📍 Service URLs:"
echo "   • Madara RPC:    http://localhost:9944"
echo "   • Redis:         redis://localhost:6379"
echo "   • IPFS Gateway:  http://localhost:8080"
echo "   • IPFS API:      http://localhost:5001"
if [ -n "$COMPOSE_PROFILES" ]; then
    echo "   • Prometheus:    http://localhost:9090"
    echo "   • Grafana:       http://localhost:3001 (admin/admin)"
fi
echo ""
echo "📋 Useful commands:"
echo "   • View Madara logs:    docker logs -f vauban-madara-l3"
echo "   • Stop devnet:         docker-compose down"
echo "   • Reset devnet:        docker-compose down -v && ./scripts/start-devnet.sh"
echo "   • Deploy contracts:    ./contracts/scripts/deploy.sh"
echo ""
