# Infrastructure Development Standards

> Reference for Kubernetes, Helm, Docker, ArgoCD, and CI/CD

---

## Kubernetes Manifests

### Deployment Requirements

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-service
  labels:
    app.kubernetes.io/name: my-service
    app.kubernetes.io/version: "1.2.3"
    app.kubernetes.io/component: backend
    app.kubernetes.io/part-of: platform
    app.kubernetes.io/managed-by: helm
spec:
  replicas: 3
  selector:
    matchLabels:
      app.kubernetes.io/name: my-service
  template:
    metadata:
      labels:
        app.kubernetes.io/name: my-service
    spec:
      # ✅ MANDATORY: Security context
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      
      containers:
        - name: my-service
          image: my-registry/my-service:1.2.3
          
          # ✅ MANDATORY: Resource limits
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
          
          # ✅ MANDATORY: Health probes
          livenessProbe:
            httpGet:
              path: /health/live
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 10
            failureThreshold: 3
          
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
          
          # ✅ MANDATORY: Security context per container
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop:
                - ALL
          
          # ✅ Env from secrets (never hardcode)
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: my-service-secrets
                  key: database-url
          
          # Volume mounts for read-only filesystem
          volumeMounts:
            - name: tmp
              mountPath: /tmp
            - name: cache
              mountPath: /app/.cache
      
      volumes:
        - name: tmp
          emptyDir: {}
        - name: cache
          emptyDir: {}
```

---

## Secrets Management

### ❌ FORBIDDEN: Secrets in Manifests

```yaml
# ❌ NEVER DO THIS
apiVersion: v1
kind: Secret
metadata:
  name: my-secret
stringData:
  api-key: "sk-1234567890abcdef"  # EXPOSED IN GIT!
```

### ✅ REQUIRED: External Secrets Operator

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: my-service-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: vault-backend
  target:
    name: my-service-secrets
    creationPolicy: Owner
  data:
    - secretKey: database-url
      remoteRef:
        key: my-service/prod
        property: DATABASE_URL
    - secretKey: api-key
      remoteRef:
        key: my-service/prod
        property: API_KEY
```

---

## Helm Charts

### Chart Structure

```
charts/my-service/
├── Chart.yaml
├── values.yaml
├── values-dev.yaml
├── values-staging.yaml
├── values-prod.yaml
├── templates/
│   ├── _helpers.tpl
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── hpa.yaml
│   ├── pdb.yaml
│   ├── serviceaccount.yaml
│   └── external-secret.yaml
└── tests/
    └── test-connection.yaml
```

### values.yaml Template

```yaml
# Default values for my-service
replicaCount: 2

image:
  repository: my-registry/my-service
  tag: ""  # Overridden by CI
  pullPolicy: IfNotPresent

# ✅ MANDATORY: Resource defaults
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi

# ✅ MANDATORY: Health checks
healthCheck:
  liveness:
    path: /health/live
    initialDelaySeconds: 10
  readiness:
    path: /health/ready
    initialDelaySeconds: 5

# ✅ MANDATORY: Pod Disruption Budget
pdb:
  enabled: true
  minAvailable: 1

# ✅ MANDATORY: Horizontal Pod Autoscaler
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

# Service configuration
service:
  type: ClusterIP
  port: 80
  targetPort: 8080

# Ingress configuration
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: my-service.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: my-service-tls
      hosts:
        - my-service.example.com
```

### Helm Commands

```bash
# Lint chart
helm lint charts/my-service

# Template locally (dry-run)
helm template my-service charts/my-service -f values-prod.yaml

# Install/upgrade
helm upgrade --install my-service charts/my-service \
  --namespace production \
  --values values-prod.yaml \
  --wait --timeout 5m

# Diff before apply (requires helm-diff plugin)
helm diff upgrade my-service charts/my-service -f values-prod.yaml
```

---

## Docker

### Dockerfile Best Practices

```dockerfile
# ✅ Multi-stage build
FROM node:20-alpine AS builder

WORKDIR /app

# ✅ Copy package files first for layer caching
COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile

COPY . .
RUN npm run build

# ✅ Minimal production image
FROM node:20-alpine AS runner

# ✅ Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app

# ✅ Copy only production dependencies
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# ✅ Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["npm", "start"]
```

### Docker Compose (Development)

```yaml
# docker-compose.yml
version: "3.8"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: builder  # Use builder stage for dev
    volumes:
      - .:/app
      - /app/node_modules  # Preserve node_modules from container
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgres://user:pass@db:5432/app
    depends_on:
      - db
    command: npm run dev

  db:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: app
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

---

## ArgoCD

### Application Manifest

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-service
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  
  source:
    repoURL: https://github.com/org/repo.git
    targetRevision: HEAD
    path: k8s/my-service
    helm:
      valueFiles:
        - values-prod.yaml
  
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
      allowEmpty: false
    syncOptions:
      - CreateNamespace=true
      - PrunePropagationPolicy=foreground
      - PruneLast=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
```

### Verification Commands

```bash
# Check sync status
argocd app get my-service

# Force sync
argocd app sync my-service

# Wait for rollout
kubectl rollout status deployment/my-service -n production --timeout=5m

# Verify pods healthy
kubectl get pods -n production -l app.kubernetes.io/name=my-service
```

---

## Pre-Deployment Checklist

```
□ Helm lint passes: helm lint charts/my-service
□ Template renders correctly: helm template ...
□ All resources have resource limits
□ All containers run as non-root
□ Health probes configured
□ PDB configured for HA
□ Secrets use External Secrets (not hardcoded)
□ Image tag is pinned (not :latest)
□ Network policies defined
□ ArgoCD sync successful
□ Rollout status verified
□ Smoke tests pass
```

---

## Troubleshooting

```bash
# Pod not starting
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace> --previous

# Resource pressure
kubectl top pods -n <namespace>
kubectl describe node <node-name>

# Network issues
kubectl exec -it <pod> -- nslookup <service>
kubectl exec -it <pod> -- curl -v http://<service>:<port>/health

# ArgoCD sync issues
argocd app diff my-service
argocd app sync my-service --dry-run
```

---

*Apply these standards to all infrastructure code without exception.*
