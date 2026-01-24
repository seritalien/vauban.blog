# AI Services Infrastructure

Local AI infrastructure with RAG capabilities for Vauban Blog.

## Components

| Component | Description | URL |
|-----------|-------------|-----|
| LocalAI | OpenAI-compatible LLM inference server | `http://localai:8080` (internal) |
| Open WebUI | ChatGPT-like web interface | https://ai.vauban.tech |
| Qdrant | Vector database for RAG | `http://qdrant:6333` (internal) |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      ai-services namespace                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │   Open      │───►│   LocalAI   │    │   Qdrant    │          │
│  │   WebUI     │    │   (LLM)     │    │  (Vectors)  │          │
│  │  :8080      │    │   :8080     │    │   :6333     │          │
│  └──────┬──────┘    └─────────────┘    └──────▲──────┘          │
│         │                                      │                 │
│         └──────────────────────────────────────┘                 │
│         ▲                  ▲                   ▲                 │
│         │                  │                   │                 │
│    [Traefik]          [n8n namespace]     [n8n namespace]       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Models

| Model | Size | Usage | RAM Required |
|-------|------|-------|--------------|
| `mistral-7b-instruct-v0.3.Q4_K_M` | 4.1GB | Chat, redaction | 6GB |
| `nomic-embed-text-v1.5.Q4_K_M` | 274MB | Embeddings (RAG) | 512MB |
| `phi-3-mini-4k-instruct.Q4_K_M` | 2.2GB | Taches legeres | 4GB |

## Initial Setup

### 1. Create Sealed Secret

```bash
# Generate a random secret key
SECRET_KEY=$(openssl rand -hex 32)

# Create and seal the secret
kubectl create secret generic open-webui-secrets \
  --namespace ai-services \
  --from-literal=WEBUI_SECRET_KEY="$SECRET_KEY" \
  --dry-run=client -o yaml | kubeseal --format yaml \
  > k8s/k8s/ai-services/01-sealed-secrets.yaml
```

### 2. Deploy via ArgoCD

```bash
kubectl apply -f k8s/argocd/ai-services.yaml
```

Or sync manually:

```bash
argocd app sync ai-services
```

### 3. Download Models

Use the provided Job to download all models:

```bash
# Apply the model download job
kubectl apply -f k8s/k8s/ai-services/05-model-download-job.yaml

# Watch progress
kubectl logs -n ai-services -l component=model-download -f

# Verify completion
kubectl get job -n ai-services model-download

# Cleanup (auto-deleted after 1 hour)
kubectl delete job -n ai-services model-download
```

**Alternative: Manual download**

```bash
# Create a temporary pod with the PVC mounted
kubectl run model-downloader \
  --namespace ai-services \
  --image=curlimages/curl:8.5.0 \
  --restart=Never \
  --overrides='
{
  "spec": {
    "containers": [{
      "name": "model-downloader",
      "image": "curlimages/curl:8.5.0",
      "command": ["sleep", "infinity"],
      "volumeMounts": [{
        "name": "models",
        "mountPath": "/models"
      }]
    }],
    "volumes": [{
      "name": "models",
      "persistentVolumeClaim": {
        "claimName": "localai-models"
      }
    }]
  }
}'

# Exec into the pod and download models
kubectl exec -it model-downloader -n ai-services -- sh

# Inside the pod:
cd /models

# Mistral 7B (4.1GB)
curl -L -o mistral-7b-instruct-v0.3.Q4_K_M.gguf \
  "https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/mistral-7b-instruct-v0.3.Q4_K_M.gguf"

# Nomic Embed (274MB)
curl -L -o nomic-embed-text-v1.5.Q4_K_M.gguf \
  "https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.Q4_K_M.gguf"

# Phi-3 Mini (2.2GB) - optional
curl -L -o phi-3-mini-4k-instruct.Q4_K_M.gguf \
  "https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf"

# Exit and cleanup
exit
kubectl delete pod model-downloader -n ai-services
```

### 4. Restart LocalAI

After downloading models, restart LocalAI to load them:

```bash
kubectl rollout restart deployment/localai -n ai-services
kubectl rollout status deployment/localai -n ai-services
```

## Usage

### Web Interface

1. Navigate to https://ai.vauban.tech
2. Create an admin account on first access
3. Start chatting with Mistral

### API Access (OpenAI-compatible)

```bash
# From within the cluster
curl http://localai.ai-services:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mistral",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'

# Embeddings for RAG
curl http://localai.ai-services:8080/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "text-embedding",
    "input": "Your text to embed"
  }'
```

### Qdrant Vector Database

```bash
# Create a collection
curl -X PUT http://qdrant.ai-services:6333/collections/documents \
  -H "Content-Type: application/json" \
  -d '{
    "vectors": {
      "size": 768,
      "distance": "Cosine"
    }
  }'

# Insert vectors
curl -X PUT http://qdrant.ai-services:6333/collections/documents/points \
  -H "Content-Type: application/json" \
  -d '{
    "points": [
      {
        "id": 1,
        "vector": [0.1, 0.2, ...],
        "payload": {"text": "Document content", "source": "file.md"}
      }
    ]
  }'

# Search similar vectors
curl -X POST http://qdrant.ai-services:6333/collections/documents/points/search \
  -H "Content-Type: application/json" \
  -d '{
    "vector": [0.1, 0.2, ...],
    "limit": 5,
    "with_payload": true
  }'
```

### n8n Integration

Use these endpoints in n8n HTTP Request nodes:

| Service | Endpoint | Method | Body |
|---------|----------|--------|------|
| LocalAI Chat | `http://localai.ai-services:8080/v1/chat/completions` | POST | `{"model": "mistral", "messages": [...]}` |
| LocalAI Embed | `http://localai.ai-services:8080/v1/embeddings` | POST | `{"model": "text-embedding", "input": "..."}` |
| Qdrant Search | `http://qdrant.ai-services:6333/collections/{name}/points/search` | POST | `{"vector": [...], "limit": 5}` |

## RAG Pipeline

### Recommended Collections

| Collection | Purpose | Vector Size |
|------------|---------|-------------|
| `vauban_blog_articles` | Blog posts + metadata | 768 |
| `vauban_documentation` | Technical docs (CLAUDE.md) | 768 |
| `infrastructure_runbooks` | K8s, Docker, deployment docs | 768 |

### Ingestion Workflow (n8n)

1. **Fetch content** from Git repos, blog content, docs
2. **Chunk text** (512 tokens, 50 overlap)
3. **Generate embeddings** via LocalAI
4. **Upsert to Qdrant** with metadata

## Use Cases

### 1. Blog Editorial Assistant

System prompt (configure in Open WebUI):

```
Tu es un assistant editorial pour Vauban Blog, une plateforme de blogging decentralisee.

Contexte technique:
- Stack: Madara L3, Arweave, IPFS, Next.js 15, Cairo
- Audience: Developpeurs Web3, enthousiastes blockchain, early adopters

Tes capacites:
1. Aide a la redaction d'articles techniques
2. Suggestions de titres accrocheurs
3. Revision et amelioration du style
4. Generation de metadonnees (tags, excerpt)
5. Traduction FR <-> EN
```

### 2. Documentation RAG

For RAG-enabled documentation queries:
1. Ingest documents to Qdrant (via n8n workflow)
2. Query via Open WebUI with "documentation-assistant" prompt
3. Context is automatically retrieved and injected

## Monitoring

### Health Checks

```bash
# LocalAI readiness
kubectl exec -n ai-services deploy/localai -- wget -qO- http://localhost:8080/readyz

# Open WebUI health
kubectl exec -n ai-services deploy/open-webui -- wget -qO- http://localhost:8080/health

# Qdrant health
kubectl exec -n ai-services deploy/qdrant -- wget -qO- http://localhost:6333/readyz
```

### Prometheus Metrics

ServiceMonitors are configured for:
- LocalAI: `/metrics` on port 8080
- Qdrant: `/metrics` on port 6333

### Logs

```bash
# LocalAI logs
kubectl logs -n ai-services deploy/localai -f

# Open WebUI logs
kubectl logs -n ai-services deploy/open-webui -f

# Qdrant logs
kubectl logs -n ai-services deploy/qdrant -f
```

### Resource Usage

```bash
kubectl top pods -n ai-services
```

## Troubleshooting

### LocalAI Not Starting

1. Check if models are downloaded:
   ```bash
   kubectl exec -n ai-services deploy/localai -- ls -la /models/
   ```

2. Check memory allocation:
   ```bash
   kubectl describe pod -n ai-services -l component=localai
   ```

3. Increase memory limits if OOMKilled

### Open WebUI Can't Connect to LocalAI

1. Verify LocalAI is ready:
   ```bash
   kubectl get pods -n ai-services -l component=localai
   ```

2. Check network policy:
   ```bash
   kubectl get networkpolicy -n ai-services
   ```

3. Test connectivity:
   ```bash
   kubectl exec -n ai-services deploy/open-webui -- wget -qO- http://localai:8080/readyz
   ```

### Qdrant Not Responding

1. Check pod status:
   ```bash
   kubectl get pods -n ai-services -l component=qdrant
   ```

2. Check storage:
   ```bash
   kubectl exec -n ai-services deploy/qdrant -- df -h /qdrant/storage
   ```

### Slow Inference

1. Check CPU usage - may need more cores
2. Consider using lighter model (phi3 instead of mistral)
3. Reduce context size in model config

## Migration to Ollama

When ready to migrate to Ollama:

1. Deploy Ollama in parallel:
   ```yaml
   image: ollama/ollama:latest
   ports:
     - 11434:11434
   ```

2. Update Open WebUI to use both backends:
   ```yaml
   env:
     - name: OLLAMA_BASE_URL
       value: "http://ollama:11434"
     - name: OPENAI_API_BASE_URL
       value: "http://localai:8080/v1"
   ```

3. Test and migrate gradually

4. Decommission LocalAI when ready

## Resource Requirements

| Component | CPU Request | CPU Limit | Memory Request | Memory Limit | Storage |
|-----------|-------------|-----------|----------------|--------------|---------|
| LocalAI | 500m | 4 | 2Gi | 8Gi | 20Gi |
| Open WebUI | 100m | 500m | 256Mi | 512Mi | 5Gi |
| Qdrant | 100m | 1 | 256Mi | 1Gi | 10Gi |
| **Total** | 700m | 5.5 | 2.5Gi | 9.5Gi | 35Gi |

## Files Reference

| File | Description |
|------|-------------|
| `00-namespace.yaml` | Namespace with ResourceQuota |
| `01-sealed-secrets.yaml` | Open WebUI secrets (sealed) |
| `02-configmaps.yaml` | Model configs + system prompts |
| `03-pvc.yaml` | Persistent storage (models, data, vectors) |
| `05-model-download-job.yaml` | One-time model download Job |
| `10-localai-deployment.yaml` | LocalAI deployment |
| `11-localai-service.yaml` | LocalAI ClusterIP service |
| `15-qdrant-deployment.yaml` | Qdrant deployment |
| `16-qdrant-service.yaml` | Qdrant ClusterIP service |
| `20-open-webui-deployment.yaml` | Open WebUI deployment |
| `21-open-webui-service.yaml` | Open WebUI ClusterIP service |
| `30-ingress.yaml` | Traefik ingress + rate limiting |
| `40-servicemonitor.yaml` | Prometheus ServiceMonitors |
| `50-network-policies.yaml` | Network security policies |
