# Vauban Blog - Kubernetes Deployment

Kubernetes/k3s manifests for deploying Vauban Blog.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         k3s Cluster                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Traefik   │──│   Ingress   │──│  vauban.blog            │ │
│  │  (Ingress)  │  │             │  │  www.vauban.blog        │ │
│  └─────────────┘  └──────┬──────┘  └─────────────────────────┘ │
│                          │                                      │
│  ┌───────────────────────▼───────────────────────────────────┐ │
│  │                    Frontend (x3)                          │ │
│  │               Next.js 15 + React 19                       │ │
│  │                   Port 3000                               │ │
│  └───────────────────────┬───────────────────────────────────┘ │
│                          │                                      │
│  ┌──────────┐  ┌─────────▼──────────┐  ┌───────────────────┐   │
│  │  Redis   │  │       IPFS         │  │      Madara       │   │
│  │  Cache   │  │   Content Store    │  │   L3 Blockchain   │   │
│  │  :6379   │  │  :5001 :8080       │  │   :9944 :9945     │   │
│  └──────────┘  └────────────────────┘  └───────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     CronJob                              │   │
│  │            publish-scheduled (every 1m)                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- k3s cluster running
- kubectl configured
- (Optional) kustomize CLI

### Deploy to Staging

```bash
./deploy.sh staging
```

### Deploy to Production

```bash
./deploy.sh production
```

### Manual Deployment

```bash
# Staging
kubectl apply -k overlays/staging

# Production
kubectl apply -k overlays/production
```

## Directory Structure

```
k8s/
├── base/                          # Base manifests
│   ├── namespace.yaml             # Namespace definition
│   ├── frontend-deployment.yaml   # Frontend Deployment + PVC
│   ├── frontend-service.yaml      # Frontend Service
│   ├── ipfs-deployment.yaml       # IPFS Deployment + PVC + Service
│   ├── redis-deployment.yaml      # Redis Deployment + PVC + Service
│   ├── madara-deployment.yaml     # Madara Deployment + PVC + Service
│   ├── configmaps.yaml            # ConfigMaps for all services
│   ├── secrets.yaml               # Secrets templates (DO NOT commit real values!)
│   ├── ingress.yaml               # Ingress + Traefik middleware
│   ├── cronjob.yaml               # Scheduled publishing CronJob
│   └── kustomization.yaml         # Base kustomization
│
├── overlays/
│   ├── staging/
│   │   └── kustomization.yaml     # Staging-specific config
│   └── production/
│       └── kustomization.yaml     # Production-specific config
│
├── deploy.sh                      # Deployment script
└── README.md                      # This file
```

## Configuration

### Environment Variables

Configure in `overlays/{env}/kustomization.yaml`:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_MADARA_RPC` | Madara RPC endpoint |
| `NEXT_PUBLIC_IPFS_GATEWAY_URL` | IPFS gateway URL |
| `NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS` | Blog registry contract address |
| `NEXT_PUBLIC_SOCIAL_ADDRESS` | Social contract address |
| `M2M_API_KEY` | M2M API key for publishing |
| `CRON_SECRET` | Secret for cron job authentication |

### Secrets

**Important**: Never commit real secrets to git!

For production, use one of:
- [Sealed Secrets](https://sealed-secrets.netlify.app/)
- [External Secrets Operator](https://external-secrets.io/)
- k3s secrets from file

```bash
# Create secrets from file
kubectl create secret generic frontend-secrets \
  --from-literal=M2M_API_KEY=your-key \
  --from-literal=CRON_SECRET=your-secret \
  -n vauban
```

### TLS Certificates

Using cert-manager with Let's Encrypt:

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.0/cert-manager.yaml

# Create ClusterIssuer
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: traefik
EOF
```

## Monitoring

### Check pod status

```bash
kubectl get pods -n vauban
```

### View logs

```bash
# Frontend logs
kubectl logs -f deployment/frontend -n vauban

# Madara logs
kubectl logs -f deployment/madara -n vauban
```

### Port forward for debugging

```bash
# Access frontend locally
kubectl port-forward svc/frontend 3000:80 -n vauban

# Access IPFS API
kubectl port-forward svc/ipfs 5001:5001 -n vauban

# Access Madara RPC
kubectl port-forward svc/madara 9944:9944 -n vauban
```

## Scaling

```bash
# Scale frontend
kubectl scale deployment/frontend --replicas=5 -n vauban
```

## Troubleshooting

### Pod not starting

```bash
kubectl describe pod <pod-name> -n vauban
kubectl logs <pod-name> -n vauban --previous
```

### PVC stuck in Pending

```bash
kubectl get pvc -n vauban
kubectl describe pvc <pvc-name> -n vauban
```

### Ingress not working

```bash
kubectl get ingress -n vauban
kubectl describe ingress vauban-ingress -n vauban
kubectl logs -n kube-system -l app.kubernetes.io/name=traefik
```

## CI/CD

GitHub Actions workflow (`.github/workflows/ci-cd.yml`):

1. **Test**: Run tests on all PRs
2. **Build**: Build and push Docker image to GHCR
3. **Deploy Staging**: Auto-deploy to staging on push to main
4. **Deploy Production**: Deploy on tag push (v*)

Required secrets in GitHub:
- `KUBECONFIG_STAGING`: Base64-encoded kubeconfig for staging
- `KUBECONFIG_PRODUCTION`: Base64-encoded kubeconfig for production
