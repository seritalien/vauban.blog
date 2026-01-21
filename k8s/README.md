# Kubernetes Deployment for Vauban Blog

This directory contains Kubernetes manifests for deploying Vauban Blog to a k3s cluster.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRODUCTION                                   │
│  ┌──────────────────┐  Blue-Green  ┌──────────────────┐             │
│  │  frontend-blue   │ ←─────────→  │  frontend-green  │             │
│  └────────┬─────────┘              └────────┬─────────┘             │
│           │ Argo Rollouts                   │                       │
│           └─────────────┬───────────────────┘                       │
│                         ▼                                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Traefik Ingress                            │   │
│  │              blog.vauban.tech (active)                        │   │
│  │         preview.blog.vauban.tech (preview)                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Supporting Services:                                                │
│  ┌─────────┐  ┌─────────┐  ┌─────────────────────┐                 │
│  │  Redis  │  │  IPFS   │  │ CronJob (scheduler) │                 │
│  └─────────┘  └─────────┘  └─────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         STAGING                                      │
│  ┌──────────────────┐                                               │
│  │     frontend     │ (single replica, RollingUpdate)               │
│  └────────┬─────────┘                                               │
│           │                                                          │
│  ┌────────▼────────────────────────────────────────────────────┐    │
│  │              blog.staging.vauban.tech                        │    │
│  └──────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
k8s/
├── argocd/                    # ArgoCD Application manifests
│   ├── staging.yaml          # Staging app (auto-sync)
│   ├── production.yaml       # Production app (manual sync)
│   ├── applicationset.yaml   # Alternative: ApplicationSet approach
│   └── project.yaml          # AppProject with RBAC
│
└── k8s/vauban-blog/
    ├── staging/              # Staging environment
    │   ├── 00-namespace.yaml
    │   ├── 01-sealed-secrets.yaml
    │   ├── ...
    │   └── kustomization.yaml
    │
    └── production/           # Production (Blue-Green)
        ├── 10-frontend-rollout.yaml    # Argo Rollout
        ├── 70-analysistemplate.yaml    # Health checks
        └── kustomization.yaml
```

## Quick Start

### 1. Generate Sealed Secrets

```bash
# Staging
kubectl create secret generic vauban-blog-secrets \
  --namespace=vauban-blog-staging \
  --from-literal=M2M_API_KEY="$(openssl rand -base64 32)" \
  --from-literal=CRON_SECRET="$(openssl rand -base64 32)" \
  --dry-run=client -o yaml | \
  kubeseal --controller-name=sealed-secrets \
           --controller-namespace=sealed-secrets \
           -o yaml > k8s/k8s/vauban-blog/staging/01-sealed-secrets.yaml
```

### 2. Deploy with ArgoCD

```bash
kubectl apply -f k8s/argocd/project.yaml
kubectl apply -f k8s/argocd/staging.yaml
kubectl apply -f k8s/argocd/production.yaml
```

### 3. Or Deploy with Kustomize

```bash
kubectl apply -k k8s/k8s/vauban-blog/staging/
kubectl apply -k k8s/k8s/vauban-blog/production/
```

## Blue-Green Rollouts (Production)

```bash
# Check status
kubectl argo rollouts status frontend -n vauban-blog

# Promote preview to active
kubectl argo rollouts promote frontend -n vauban-blog

# Rollback
kubectl argo rollouts undo frontend -n vauban-blog
```

## URLs

| Environment | URL |
|-------------|-----|
| Staging | https://blog.staging.vauban.tech |
| Production | https://blog.vauban.tech |
| Preview | https://preview.blog.vauban.tech |
| IPFS Gateway | https://ipfs.vauban.tech |
