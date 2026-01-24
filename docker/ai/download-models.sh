#!/bin/bash
# Download LLM models for LocalAI
# Run this before starting the AI services
#
# Usage:
#   ./download-models.sh           # Download to Docker volume
#   ./download-models.sh ./models  # Download to local directory
#
set -e

# Default to Docker volume location
MODELS_DIR="${1:-}"

if [ -z "$MODELS_DIR" ]; then
    # Download directly to Docker volume
    VOLUME_NAME="vauban-localai-models"

    echo "=== Downloading models to Docker volume: $VOLUME_NAME ==="

    # Create volume if it doesn't exist
    docker volume create "$VOLUME_NAME" 2>/dev/null || true

    # Run download in a container (using alpine with wget for proper permissions)
    docker run --rm \
        -v "$VOLUME_NAME:/models" \
        --user root \
        alpine:3.19 \
        sh -c '
            apk add --no-cache wget
            cd /models

            echo "=== Downloading Mistral 7B Instruct v0.3 (~4.1GB) ==="
            if [ ! -f "mistral-7b-instruct-v0.3.Q4_K_M.gguf" ]; then
                wget --progress=bar:force:noscroll -O "mistral-7b-instruct-v0.3.Q4_K_M.gguf" \
                    "https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3-Q4_K_M.gguf"
            else
                echo "Already exists, skipping"
            fi

            echo ""
            echo "=== Downloading Nomic Embed Text v1.5 (~274MB) ==="
            if [ ! -f "nomic-embed-text-v1.5.Q4_K_M.gguf" ]; then
                wget --progress=bar:force:noscroll -O "nomic-embed-text-v1.5.Q4_K_M.gguf" \
                    "https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.Q4_K_M.gguf"
            else
                echo "Already exists, skipping"
            fi

            # Fix permissions for LocalAI (runs as uid 1000)
            chown -R 1000:1000 /models/

            echo ""
            echo "=== Download complete ==="
            ls -lh /models/
        '

    # Copy model configs to the volume
    echo ""
    echo "=== Copying model configurations ==="
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    docker run --rm \
        -v "$VOLUME_NAME:/models" \
        -v "$SCRIPT_DIR/models:/configs:ro" \
        busybox:1.36 \
        sh -c 'cp /configs/*.yaml /models/'

    echo ""
    echo "=== Models ready in Docker volume: $VOLUME_NAME ==="
    docker run --rm -v "$VOLUME_NAME:/models:ro" busybox:1.36 ls -lh /models/

else
    # Download to local directory
    echo "=== Downloading models to: $MODELS_DIR ==="
    mkdir -p "$MODELS_DIR"
    cd "$MODELS_DIR"

    echo "=== Downloading Mistral 7B Instruct v0.3 (~4.1GB) ==="
    if [ ! -f "mistral-7b-instruct-v0.3.Q4_K_M.gguf" ]; then
        curl -L --progress-bar -o "mistral-7b-instruct-v0.3.Q4_K_M.gguf" \
            "https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/mistral-7b-instruct-v0.3.Q4_K_M.gguf"
    else
        echo "Already exists, skipping"
    fi

    echo ""
    echo "=== Downloading Nomic Embed Text v1.5 (~274MB) ==="
    if [ ! -f "nomic-embed-text-v1.5.Q4_K_M.gguf" ]; then
        curl -L --progress-bar -o "nomic-embed-text-v1.5.Q4_K_M.gguf" \
            "https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.Q4_K_M.gguf"
    else
        echo "Already exists, skipping"
    fi

    # Copy model configs
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    cp "$SCRIPT_DIR/models/"*.yaml "$MODELS_DIR/"

    echo ""
    echo "=== Download complete ==="
    ls -lh "$MODELS_DIR/"
fi

echo ""
echo "=== Next steps ==="
echo "1. Start AI services:"
echo "   cd docker && docker compose -f docker-compose.ai.yml up -d"
echo ""
echo "2. Wait for LocalAI to be ready (check health):"
echo "   docker logs -f vauban-localai"
echo ""
echo "3. Access Open WebUI:"
echo "   http://localhost:3000"
