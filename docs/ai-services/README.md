# AI Services Infrastructure

Local AI infrastructure with RAG capabilities for Vauban Blog.

## Components

| Component | Description | URL |
|-----------|-------------|-----|
| LocalAI | OpenAI-compatible LLM inference server | `http://localai:8080` (internal) |
| Open WebUI | ChatGPT-like web interface | https://ai.vauban.tech |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ai-services namespace                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐                         │
│  │   Open      │───►│   LocalAI   │                         │
│  │   WebUI     │    │   (LLM)     │                         │
│  │  :8080      │    │   :8080     │                         │
│  └─────────────┘    └─────────────┘                         │
│         ▲                  ▲                                 │
│         │                  │                                 │
│    [Traefik]          [n8n namespace]                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Models

| Model | Size | Usage | RAM Required |
|-------|------|-------|--------------|
| `mistral-7b-instruct-v0.3.Q4_K_M` | 4.1GB | Chat, rédaction | 6GB |
| `nomic-embed-text-v1.5.Q4_K_M` | 274MB | Embeddings (RAG) | 512MB |
| `phi-3-mini-4k-instruct.Q4_K_M` | 2.2GB | Tâches légères | 4GB |

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

### 2. Download Models

Models need to be downloaded manually to the PVC. Connect to the cluster and run:

```bash
# Create a temporary pod with the PVC mounted
kubectl run model-downloader \
  --namespace ai-services \
  --image=busybox:1.36 \
  --restart=Never \
  --overrides='
{
  "spec": {
    "containers": [{
      "name": "model-downloader",
      "image": "busybox:1.36",
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
wget "https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/mistral-7b-instruct-v0.3.Q4_K_M.gguf"

# Nomic Embed (274MB)
wget "https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.Q4_K_M.gguf"

# Phi-3 Mini (2.2GB) - optional
wget "https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf" \
  -O phi-3-mini-4k-instruct.Q4_K_M.gguf

# Exit and cleanup
exit
kubectl delete pod model-downloader -n ai-services
```

### 3. Deploy via ArgoCD

```bash
kubectl apply -f k8s/argocd/ai-services.yaml
```

Or sync manually:

```bash
argocd app sync ai-services
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

### n8n Integration

Use these endpoints in n8n HTTP Request nodes:

| Endpoint | Method | Body |
|----------|--------|------|
| `http://localai.ai-services:8080/v1/chat/completions` | POST | `{"model": "mistral", "messages": [...]}` |
| `http://localai.ai-services:8080/v1/embeddings` | POST | `{"model": "text-embedding", "input": "..."}` |

## Use Cases

### 1. Blog Editorial Assistant

System prompt (configure in Open WebUI):

```
Tu es un assistant éditorial pour Vauban Blog, une plateforme de blogging décentralisée.

Contexte technique:
- Stack: Madara L3, Arweave, IPFS, Next.js 15, Cairo
- Audience: Développeurs Web3, enthousiastes blockchain, early adopters

Tes capacités:
1. Aide à la rédaction d'articles techniques
2. Suggestions de titres accrocheurs
3. Révision et amélioration du style
4. Génération de métadonnées (tags, excerpt)
5. Traduction FR ↔ EN
```

### 2. Documentation RAG

For RAG-enabled documentation queries, ingest documents to Qdrant first, then query via Open WebUI with the "documentation-assistant" prompt.

## Monitoring

### Health Checks

```bash
# LocalAI readiness
kubectl exec -n ai-services deploy/localai -- wget -qO- http://localhost:8080/readyz

# Open WebUI health
kubectl exec -n ai-services deploy/open-webui -- wget -qO- http://localhost:8080/health
```

### Logs

```bash
# LocalAI logs
kubectl logs -n ai-services deploy/localai -f

# Open WebUI logs
kubectl logs -n ai-services deploy/open-webui -f
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
| **Total** | 600m | 4.5 | 2.3Gi | 8.5Gi | 25Gi |
