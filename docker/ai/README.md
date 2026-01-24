# Local AI Services Testing

Run LocalAI, Open WebUI, and Qdrant locally for testing before k3s deployment.

## Quick Start

```bash
# 1. Download models (~4.4GB total)
./download-models.sh

# 2. Create the network (if not exists)
docker network create vauban-network 2>/dev/null || true

# 3. Start AI services
docker compose -f docker-compose.ai.yml up -d

# 4. Watch LocalAI startup (takes 1-2 min to load models)
docker logs -f vauban-localai

# 5. Access services
# Open WebUI: http://localhost:3000
# LocalAI API: http://localhost:8080
# Qdrant API: http://localhost:6333
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Open WebUI | 3000 | ChatGPT-like interface |
| LocalAI | 8080 | OpenAI-compatible API |
| Qdrant | 6333 | Vector database |

## Test LocalAI API

```bash
# Health check
curl http://localhost:8080/readyz

# List models
curl http://localhost:8080/v1/models | jq

# Chat completion
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mistral",
    "messages": [{"role": "user", "content": "Hello!"}]
  }' | jq

# Generate embeddings
curl http://localhost:8080/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "text-embedding",
    "input": "Test embedding"
  }' | jq
```

## Test Qdrant

```bash
# Health
curl http://localhost:6333/readyz

# Create collection
curl -X PUT http://localhost:6333/collections/test \
  -H "Content-Type: application/json" \
  -d '{
    "vectors": {"size": 768, "distance": "Cosine"}
  }'

# List collections
curl http://localhost:6333/collections | jq
```

## Test Open WebUI

1. Open http://localhost:3000
2. Create admin account on first visit
3. Start chatting with Mistral

## Run with Main Services

To run AI services alongside Madara, Redis, IPFS:

```bash
docker compose -f docker-compose.yml -f docker-compose.ai.yml up -d
```

## Troubleshooting

### LocalAI not starting
```bash
# Check logs
docker logs vauban-localai

# Verify models are downloaded
docker run --rm -v vauban-localai-models:/models:ro busybox ls -la /models/

# Re-download models
./download-models.sh
```

### Out of memory
LocalAI needs ~6GB RAM for Mistral 7B. Reduce memory by using smaller models:
- Edit `models/mistral.yaml` to use a smaller quantization (Q3_K_S instead of Q4_K_M)
- Or use Phi-3 Mini instead (2.2GB)

### Open WebUI can't connect to LocalAI
```bash
# Check LocalAI is healthy
curl http://localhost:8080/readyz

# Check network connectivity
docker exec vauban-open-webui wget -qO- http://localai:8080/readyz
```

## Stop Services

```bash
docker compose -f docker-compose.ai.yml down

# Remove volumes (deletes models and data)
docker compose -f docker-compose.ai.yml down -v
```

## Resource Requirements

| Component | RAM | Disk |
|-----------|-----|------|
| LocalAI + Mistral 7B | ~6GB | 4.1GB |
| LocalAI + Embeddings | ~512MB | 274MB |
| Open WebUI | ~256MB | ~100MB |
| Qdrant | ~256MB | varies |
| **Total** | ~7GB | ~5GB |
