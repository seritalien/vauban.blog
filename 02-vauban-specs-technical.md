# VAUBAN BLOG - ARCHITECTURE SPECIFICATIONS 2026
## Production-Grade Web3 Platform on Baremetal K3s

**Status**: Specifications (Non-Binding Reference)  
**Version**: 2.0  
**Date**: 17 Janvier 2026  
**Hardware Target**: 8 CPU, 128GB RAM, 3.5TB NVMe (Baremetal Datacenter)  
**Deployment Model**: GitOps (ArgoCD) + Declarative K3s  
**SLA Target**: 99.9% uptime, P99 latency <500ms

---

## TABLE OF CONTENTS

1. [Architecture Overview](#1-architecture-overview)
2. [Compute Layer Specifications](#2-compute-layer-specifications)
3. [Storage & Data Layer](#3-storage--data-layer)
4. [Networking & Ingress](#4-networking--ingress)
5. [Observability Stack](#5-observability-stack)
6. [GitOps & Deployment Strategy](#6-gitops--deployment-strategy)
7. [Blockchain & Node Layer](#7-blockchain--node-layer)
8. [Disaster Recovery & Resilience](#8-disaster-recovery--resilience)

---

## 1. ARCHITECTURE OVERVIEW

### 1.1 High-Level System Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                  VAUBAN BLOG - PRODUCTION ARCHITECTURE              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  EDGE LAYER (Client-Facing)                                        │
│  ├─ CDN (Vercel/Cloudflare for static assets)                      │
│  ├─ DNS (Route53 with health checks)                               │
│  └─ DDoS Protection (Cloudflare Enterprise)                        │
│                                                                     │
│  INGRESS LAYER (K3s Entry Point)                                   │
│  ├─ nginx-ingress-controller (2 replicas, HA)                      │
│  ├─ cert-manager (Let's Encrypt + internal CA)                     │
│  ├─ rate-limiting middleware                                        │
│  └─ AuthN/Z (OAuth2 Proxy or similar)                              │
│                                                                     │
│  APPLICATION LAYER (K3s Workloads)                                 │
│  ├─ vauban-frontend (Next.js, 3-5 replicas)                        │
│  ├─ vauban-api (Backend services, 2-3 replicas)                    │
│  ├─ vauban-worker (Async tasks, 1-2 replicas)                      │
│  └─ blockchain-indexer (Madara RPC consumer)                       │
│                                                                     │
│  DATA LAYER (Stateful Services)                                    │
│  ├─ PostgreSQL (1 primary + replicas)                              │
│  ├─ Redis Cluster (3+ nodes)                                       │
│  ├─ Elasticsearch (for search)                                     │
│  └─ IPFS Node or Pinning Service (storage)                         │
│                                                                     │
│  BLOCKCHAIN LAYER                                                  │
│  ├─ Madara RPC Node (full/archive mode)                            │
│  ├─ Smart Contract State Cache                                     │
│  └─ Event Indexer (consume blockchain events)                      │
│                                                                     │
│  OBSERVABILITY LAYER                                               │
│  ├─ Prometheus (metrics, 100Gi storage)                            │
│  ├─ Loki (logs, 50Gi storage)                                      │
│  ├─ Tempo (traces, 30Gi storage)                                   │
│  ├─ Grafana (dashboards)                                           │
│  └─ AlertManager (incident routing)                                │
│                                                                     │
│  GITOPS CONTROL PLANE                                              │
│  ├─ ArgoCD (manifest sync, declarative)                            │
│  ├─ Sealed Secrets (encrypted k8s secrets in git)                  │
│  └─ Kyverno (policy enforcement)                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

Data Flows:
  User Request → CDN → Ingress (nginx) → Frontend/API (K3s) 
                                            ↓
                                    [PostgreSQL] [Redis] [ES]
                                            ↓
                                    Blockchain Layer (RPC)
                                            ↓
                                      Observability Pipeline
```

### 1.2 Design Principles

| Principle | Rationale | Implementation |
|-----------|-----------|-----------------|
| **Declarative Infrastructure** | GitOps enables reproducibility, auditability, rollback | ArgoCD syncs from Git; all state in k8s manifests |
| **Immutable Deployments** | Reduce config drift, enable fast rollbacks | Container images tagged by git commit; no manual changes |
| **Observability First** | Production systems must be measurable | 100% of requests traced; comprehensive metrics/logs |
| **Graceful Degradation** | Partial failures should not cascade | Circuit breakers; bulkheads; queue-based async |
| **Cost Efficiency** | 3.5TB storage is expensive; ROI matters | Resource quotas; auto-scaling; storage tiering |
| **Security by Default** | Zero-trust networking + secrets rotation | Network policies; Pod Security Policy; Sealed Secrets |

### 1.3 Resource Allocation (8 CPU / 128GB / 3.5TB NVMe)

**CPU Allocation** (8 cores total):
- K3s system components: 1.0 core reserved
- Application workloads: 4.0 cores allocatable
- Data layer (DB, cache): 2.0 cores reserved
- Observability: 1.0 core reserved

**Memory Allocation** (128GB total):
- K3s system + etcd: 8GB
- Application workloads: 40GB requests, 60GB limits
- PostgreSQL: 32GB (shared buffers + working set)
- Redis: 16GB
- Observability (Prometheus, Loki, Tempo): 12GB

**NVMe Allocation** (3.5TB total):
- PostgreSQL WAL + data: 1.0TB
- Redis snapshots: 100GB
- Prometheus TSDB: 100GB
- Loki chunks: 50GB
- Tempo traces: 30GB
- Elasticsearch indices: 500GB
- Container images + local storage: 700GB
- Kubernetes etcd: 50GB
- Buffer/headroom: 380GB (10%)

---

## 2. COMPUTE LAYER SPECIFICATIONS

### 2.1 K3s Cluster Configuration

**Cluster Topology:**
- **Master Node(s)**: 1 (single point of failure for dev; HA requires 3+ in prod)
- **Worker Nodes**: 0-2 (depends on workload; start with 1, add on demand)
- **Architecture**: ARM64 or x86_64 (datacenter grade)
- **K3s Version**: v1.30.x LTS (stable, patches through 2026)
- **Networking**: Flannel (default, suitable for single-datacenter)
  - Alternative: Cilium (if eBPF tracing needed for observability)
- **Storage Driver**: local-path-provisioner (suitable for single-datacenter; upgrade to Longhorn if multi-region)
- **CRI**: containerd 2.x (default, performant)

**Cluster Bootstrap Specs:**
```
Init Master:
  - etcd auto-managed by K3s
  - API Server: --max-requests-inflight=1000 --max-mutating-requests-inflight=500
  - Kubelet: --max-pods=250, --pod-pids-limit=4096
  - kube-proxy: iptables mode (sufficient for <1000 pods)

Feature Gates:
  - DefaultPodTopologySpread: true (pod anti-affinity by default)
  - DynamicResourceAllocation: false (not needed yet)
  - ElasticIndexedJob: true (for batch jobs)
```

**Addon Requirements:**
- cert-manager v1.14+ (TLS automation)
- metrics-server (already included in K3s)
- local-path-storage (already included in K3s)
- network-policy-engine (Cilium or Calico, optional but recommended)

### 2.2 Namespace Topology

**Production Namespaces:**

```yaml
Namespaces:
  vauban-prod:
    - Purpose: Application workloads (frontend, API, workers)
    - Labels: app=vauban, env=production, tier=application
    - ResourceQuota: 4 CPU requests, 60GB memory limits
    - NetworkPolicy: Ingress from nginx-ingress; egress to data layer
    - ServiceAccounts: vauban-app, vauban-worker, vauban-indexer

  vauban-data:
    - Purpose: Stateful data services (PostgreSQL, Redis, ES)
    - Labels: app=vauban, env=production, tier=data
    - ResourceQuota: 2 CPU requests, 48GB memory limits
    - NetworkPolicy: Ingress from vauban-prod only; egress unrestricted
    - ServiceAccounts: postgres-operator, redis-operator

  vauban-observability:
    - Purpose: Monitoring, logging, tracing
    - Labels: app=vauban, env=production, tier=observability
    - ResourceQuota: 1 CPU requests, 12GB memory limits
    - NetworkPolicy: Ingress from all; egress to external syslog/APM
    - ServiceAccounts: prometheus, loki, tempo, grafana

  vauban-blockchain:
    - Purpose: Starknet/Madara RPC nodes, indexers
    - Labels: app=vauban, env=production, tier=blockchain
    - ResourceQuota: 1 CPU requests, 16GB memory limits
    - NetworkPolicy: Egress to Starknet P2P network
    - ServiceAccounts: madara-rpc, indexer

  argocd:
    - Purpose: GitOps control plane
    - Labels: app=argocd, env=production
    - ResourceQuota: 1 CPU requests, 4GB memory
    - NetworkPolicy: Ingress from admin network only
    - ServiceAccounts: argocd-server, argocd-controller

  ingress-nginx:
    - Purpose: Ingress controller (L7 routing)
    - Labels: app=ingress, env=production, tier=network
    - ResourceQuota: 1 CPU requests, 8GB memory
    - NetworkPolicy: Ingress from internet (port 80, 443)
    - ServiceAccounts: nginx-ingress
```

### 2.3 Workload Specifications

#### 2.3.1 Frontend (Next.js)

**Deployment Spec:**
```
Service: vauban-frontend
Image: vauban-frontend:v{GIT_COMMIT_SHA}
Replicas: 3 (min 2, max 5 during spikes)
Port: 3000 (HTTP)
HealthCheck:
  - Liveness: GET / (30s delay, 10s period, 3 failures)
  - Readiness: GET /ready (10s delay, 5s period, 2 failures)

Resource Allocation:
  CPU:
    - Request: 250m (allows 16 replicas per 4 cores)
    - Limit: 1000m (burst during build time)
  Memory:
    - Request: 256Mi (Next.js baseline)
    - Limit: 1Gi (with in-memory cache)

Environment:
  - NODE_ENV: production
  - NEXT_PUBLIC_API_URL: http://vauban-api (internal)
  - NEXT_PUBLIC_RPC_URL: http://madara-rpc:9944
  - OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4318

Horizontal Pod Autoscaler:
  - Metric: CPU utilization (70% threshold)
  - Alternative: Request count/sec (if instrumented)
  - Scale-up: 2 pods/minute (aggressive for spike handling)
  - Scale-down: 1 pod/minute (conservative to avoid flap)

Security Context:
  - runAsNonRoot: true (user 1000)
  - readOnlyRootFilesystem: false (Next.js needs /tmp for builds)
  - allowPrivilegeEscalation: false
  - capabilities.drop: [ALL]
  - seccompProfile: RuntimeDefault
```

#### 2.3.2 Backend API (Node.js / TypeScript)

**Deployment Spec:**
```
Service: vauban-api
Image: vauban-api:v{GIT_COMMIT_SHA}
Replicas: 2 (min 2 for HA, max 4)
Port: 8080 (HTTP)
HealthCheck:
  - Liveness: GET /health (20s delay, 10s period, 3 failures)
  - Readiness: GET /ready (5s delay, 5s period, 2 failures)

Resource Allocation:
  CPU:
    - Request: 500m
    - Limit: 1500m
  Memory:
    - Request: 512Mi
    - Limit: 2Gi (includes DB connection pool)

Environment:
  - NODE_ENV: production
  - DATABASE_URL: postgresql://user:pass@postgres-primary:5432/vauban
  - REDIS_URL: redis://redis-cluster:6379/0
  - OTEL_SERVICE_NAME: vauban-api

Horizontal Pod Autoscaler:
  - Metric: CPU + custom metric (queue depth)
  - Scale-up threshold: CPU >75% OR queue >100 msgs

Security Context:
  - runAsNonRoot: true
  - readOnlyRootFilesystem: true
  - tmpfs volumes for /tmp, /var/tmp
  - capabilities.drop: [ALL]
```

#### 2.3.3 Async Worker

**StatefulSet Spec** (maintains identity across restarts):
```
Service: vauban-worker
Image: vauban-worker:v{GIT_COMMIT_SHA}
Replicas: 1 (or 2 with partition strategy for updates)
Port: N/A (no HTTP)
HealthCheck:
  - Liveness: File-based indicator (touch /tmp/alive every 10s)
  - Readiness: Connected to job queue

Resource Allocation:
  CPU: Request 500m, Limit 2000m (heavy processing)
  Memory: Request 1Gi, Limit 4Gi

Behavior:
  - Consumes jobs from Redis queue / message broker
  - Processes blockchain events, indexing, heavy computation
  - Graceful shutdown: 30s to drain queue
  - Crash loop backoff: exponential (5s to 5m)

Environment:
  - JOB_CONCURRENCY: 5 (parallel jobs per instance)
  - TIMEOUT_PER_JOB: 300s
```

#### 2.3.4 Blockchain Indexer

**Deployment Spec:**
```
Service: vauban-indexer
Image: vauban-indexer:v{GIT_COMMIT_SHA}
Replicas: 1 (single consumer from blockchain)
Port: N/A

Resource Allocation:
  CPU: Request 1000m, Limit 2000m (continuous indexing)
  Memory: Request 2Gi, Limit 4Gi (state cache)

Function:
  - Watches Starknet blocks via Madara RPC
  - Indexes contract events to PostgreSQL
  - Maintains state cache in Redis
  - Exposes metrics: blocks/sec, events/sec, indexing lag

Resilience:
  - Restarts on RPC connection failure (exponential backoff)
  - Logs to stdout (Promtail collection)
  - Metrics published to Prometheus
```

### 2.4 Pod Disruption Budget (PDB) Specifications

**Frontend PDB:**
```
minAvailable: 2
  Ensures 2 out of 3 replicas always running during node drain
  Allows safe rolling updates, node maintenance
```

**API PDB:**
```
minAvailable: 1
  Ensures 1 of 2 replicas running
  Prevents cascading failures during infrastructure updates
```

**Worker & Indexer:**
```
No PDB required (stateless or single-replica)
```

---

## 3. STORAGE & DATA LAYER

### 3.1 PostgreSQL Specifications

**Deployment Model:**
- **Primary**: 1 StatefulSet (master)
- **Replicas**: 1-2 streaming replication followers
- **Operator**: Zalando Postgres Operator (automation + HA)
- **Image**: postgres:16-alpine (latest LTS, minimal footprint)
- **Replication Slot**: physical slots for high-availability

**Storage:**
```
Primary PVC:
  - Size: 500Gi (1TB total allocation / 2)
  - AccessMode: ReadWriteOnce
  - StorageClass: local-path or nvme-class
  - Backup target: S3 or external NFS

Replica PVC:
  - Size: 300Gi each (streaming replication)
  - AccessMode: ReadWriteOnce
  - Lag monitoring: replica_lag_bytes metric
```

**Performance Tuning:**
```
Parameters:
  shared_buffers: 16GB (1/4 of system RAM)
  effective_cache_size: 48GB (3/4 of system RAM)
  maintenance_work_mem: 2GB
  checkpoint_completion_target: 0.9
  wal_buffers: 32MB
  default_statistics_target: 100
  random_page_cost: 1.1 (for SSD/NVMe)
  
Work_mem (per operation):
  - Calculated: RAM / (connections * operations)
  - Conservative: 128MB (suitable for 100 connections)
```

**Connection Pooling:**
- **PgBouncer** StatefulSet: 100-200 connection pool
- **Modes**: transaction (connection returned after each transaction) for stateless apps
- **Max connections**: 500 (tuned for 128GB RAM)

**Backup & Recovery:**
```
Backup Strategy: 3-2-1 Rule
  - 3 copies of data (primary, replica, external)
  - 2 media types (block storage + S3)
  - 1 offsite copy (different region)

Tools:
  - WAL-G (continuous archive to S3 + PITR)
  - pg_basebackup (initial full backups)
  - Barman (if recovery SLA <1h required)

Retention: 30 days WAL archive, daily full backups
RPO (Recovery Point Objective): <1 hour
RTO (Recovery Time Objective): <30 minutes
```

**Monitoring Metrics:**
```
Key Metrics:
  - Replication lag (bytes_written - bytes_flushed)
  - Slow queries (duration > 1s)
  - Connection count (pool saturation)
  - Index bloat / unused indices
  - Cache hit ratio (should be >99%)
  
Alerting Thresholds:
  - Replication lag > 100MB: warning
  - Replication lag > 500MB: critical
  - Cache hit ratio < 90%: investigate
  - Connections > 80% pool: scale up
```

### 3.2 Redis Specifications

**Deployment Model:**
- **Redis Cluster**: 3+ master nodes (fault tolerant)
- **Alternative (simpler)**: 1 primary + 1 replica + Sentinel
- **Version**: Redis 7.x (GA, performance improvements)
- **Image**: redis:7-alpine (minimal, 15MB)

**Topology:**
```
Option 1: Redis Cluster (recommended for scale)
  - 3 master nodes (sharding)
  - Each master has replica (HA)
  - Automatic failover, no Sentinel needed
  - Hash slots distributed (0-16384)

Option 2: Primary + Replica + Sentinel (simpler)
  - 1 primary, 1 replica
  - 3 Sentinel instances for failover voting
  - Better for <50GB datasets
```

**Storage:**
```
PVC per Redis node:
  - Size: 50Gi (slots distributed, each node ~16GB)
  - AccessMode: ReadWriteOnce
  - Persistence: RDB snapshots + AOF (Append-Only File)
  
Persistence Config:
  - save "": disable RDB (use AOF only for continuous writes)
  - appendonly: yes (100% durability)
  - appendfsync: everysec (balance speed + durability)
```

**Resource Allocation:**
```
CPU: 500m request, 2000m limit
Memory: 8Gi request, 16Gi limit (per node)
Maxmemory: 8GB (with eviction policy: allkeys-lru)
```

**Use Cases & TTLs:**
```
Database 0: Session cache (TTL: 24h)
Database 1: Rate limit counters (TTL: 60s)
Database 2: Queue backlog (TTL: 7 days)
Database 3: Real-time leaderboards (TTL: 30 days)
Database 4: Full-text search index (persistent)
```

**Monitoring:**
```
Key Metrics:
  - Memory usage vs maxmemory
  - Commands/sec (throughput)
  - Evictions/sec (cache misses forcing eviction)
  - Hit ratio (should be >95%)
  - Replication offset lag
  - Key expiration rate

Alerting:
  - Memory > 90% maxmemory: evictions happening
  - Replication lag > 1000 bytes: network issue
  - Evictions > 100/sec: cache thrashing
```

### 3.3 Elasticsearch Specifications

**Deployment Model:**
- **Nodes**: 2 data nodes + 1 master (HA for search index)
- **Version**: Elasticsearch 8.x (GA, RBAC built-in)
- **Shards**: 2 per index (allows split across 2 nodes)
- **Replicas**: 1 per shard (durability)

**Storage:**
```
Data nodes:
  - Size: 250Gi each (500GB total for search indices)
  - AccessMode: ReadWriteOnce
  - Index management: ILM (Index Lifecycle Management) for time-series

Master node:
  - Size: 10Gi (minimal, only cluster metadata)
  - Dedicated to coordination, no data storage
```

**Index Strategy:**
```
Index Templates:
  - blog-posts: daily indices (blog-posts-2026-01-17)
  - transactions: monthly indices
  - events: hourly (high-cardinality events)
  
ILM Policy (Index Lifecycle Management):
  - Hot: 1 day (current index, active writes)
  - Warm: 30 days (compressed, searchable)
  - Cold: 90 days (searchable but slow)
  - Delete: 365 days (auto-purge old data)
```

**Resource Allocation:**
```
Data nodes:
  - CPU: 1000m request, 2000m limit
  - Memory: 4Gi request, 8Gi limit (heap)
  
Master node:
  - CPU: 500m request, 1000m limit
  - Memory: 1Gi request, 2Gi limit
```

**Monitoring:**
```
Key Metrics:
  - Indexing latency (p99)
  - Search latency (p99)
  - Shard count, replica status
  - Index size growth
  - JVM heap usage
  
SLA Targets:
  - Indexing: <50ms p99
  - Search: <100ms p99
```

### 3.4 IPFS / Pinning Service

**Option 1: Internal IPFS Node** (if storing <100GB)
```
Deployment: Single pod + PVC
Storage: 100Gi (NVMe)
Memory: 2Gi request, 4Gi limit
CPU: 500m request, 1000m limit
Pros: Full control, no external dependency
Cons: Network bandwidth, storage overhead
```

**Option 2: Pinata / Nft.storage** (recommended for scale)
```
API-based pinning service (no local storage)
Cost: $25-100/month depending on volume
Latency: <100ms (CDN-backed)
Durability: replicated across multiple nodes
```

**Decision**: Use **Option 2 (Pinata)** for production Vauban Blog:
- No local storage overhead
- Automatic CDN for fast retrieval
- Professional SLA
- Cost amortized across user fees

---

## 4. NETWORKING & INGRESS

### 4.1 Ingress Controller Specifications

**Deployment:**
- **Type**: nginx-ingress-controller (CNCF standard)
- **Replicas**: 2 (HA across nodes)
- **Version**: ingress-nginx v1.10+

**Configuration:**
```yaml
Features:
  - SSL/TLS termination (cert-manager integration)
  - WebSocket support (for real-time updates)
  - Rate limiting (sliding window per IP)
  - Request/response rewriting
  - BasicAuth + OAuth2 middleware
  
Resource Limits:
  - Worker processes: 4 (nginx auto-tuning)
  - Worker connections: 4096 per process
  - Backlog: 1024 connections
  - Keepalive: 32 per upstream
```

**Ingress Rules:**
```yaml
Rules:
  1. vauban.blog → vauban-frontend:3000
     - Path: /
     - TLS: enabled (cert-manager)
     - Auth: optional (public site)
  
  2. api.vauban.blog → vauban-api:8080
     - Path: /
     - TLS: enabled
     - Rate limit: 1000 req/min per IP
     - CORS: configured for frontend origin
  
  3. rpc.vauban.blog → madara-rpc:9944
     - Path: /
     - TLS: enabled
     - Auth: JWT (for public RPC access)
     - Rate limit: 100 req/min per JWT token
```

### 4.2 Certificate Management

**Tool**: cert-manager v1.14+

**Issuers:**
```yaml
1. LetsEncrypt Issuer (public domains)
   - Email: admin@vauban.tech
   - Challenge: HTTP-01 (DNS-01 if behind CDN)
   - Renewal: automatic (30 days before expiry)

2. Internal CA (self-signed, internal services)
   - Used for inter-pod TLS (if required)
   - Rotated annually
```

### 4.3 Network Policies

**Ingress Policies:**
```yaml
Allow:
  - External traffic → nginx-ingress:80,443
  - nginx-ingress → vauban-prod pods:3000,8080
  - vauban-prod → vauban-data pods:5432,6379,9200
  - vauban-data → vauban-data (internal replication)
  - Observability pods → all pods (metric scraping)

Deny by default:
  - Everything else (default deny-all policy)
```

**Implementation:**
- **CNI**: Flannel (basic) or Cilium (advanced eBPF filtering)
- **Kyverno Policies**: enforce namespace labels, require resource limits

### 4.4 DNS & Load Balancing

**DNS Records:**
```
vauban.blog         → K3s Ingress IP (A record)
api.vauban.blog     → K3s Ingress IP (CNAME)
rpc.vauban.blog     → K3s Ingress IP (CNAME)

Optional CDN:
  - Cloudflare (caching + DDoS protection)
  - Points to Ingress IP
  - Cache rules: HTML (1h), assets (30d)
```

**Load Balancer Integration:**
- If behind hardware LB: use proxy protocol (`--proxy-protocol=true`)
- Real client IP preserved via `X-Forwarded-For` headers
- Health checks: `/health` endpoint on all services

---

## 5. OBSERVABILITY STACK

### 5.1 Metrics Collection (Prometheus)

**Deployment:**
```yaml
Component: Prometheus
Replicas: 1 (HA requires 2+ with federation)
Retention: 30 days (configurable based on storage)
TSDB Storage: 100Gi (NVMe)
Scrape Interval: 15 seconds
Evaluation Interval: 15 seconds
```

**Scrape Targets:**
```yaml
Jobs:
  1. Kubernetes API Server
  2. Kubelet (per node)
  3. Docker daemon metrics
  4. vauban-frontend (port 9090)
  5. vauban-api (port 9090)
  6. PostgreSQL exporter (port 9187)
  7. Redis exporter (port 9121)
  8. Elasticsearch exporter (port 9114)
  9. nginx-ingress controller metrics
  10. Madara RPC metrics (if exposed)

Relabel Configs:
  - Extract pod/namespace/node labels
  - Add environment/cluster tags
  - Drop high-cardinality metrics
```

**Key Metrics to Track:**
```
Application:
  - http_requests_total (by method, path, status)
  - http_request_duration_seconds (p50, p95, p99)
  - http_requests_inflight (concurrent connections)
  - db_query_duration_seconds (slow query detection)

Infrastructure:
  - node_cpu_seconds_total
  - node_memory_bytes (used / total)
  - node_disk_bytes (used / total)
  - container_cpu_usage_seconds_total
  - container_memory_usage_bytes

Blockchain:
  - blockchain_block_height (latest block)
  - blockchain_indexer_lag (delay in indexing)
  - rpc_call_duration_seconds (latency to Starknet)
```

**Recording Rules (pre-aggregated metrics):**
```yaml
Examples:
  - instance:node_cpu:rate5m (CPU rate per node)
  - instance:node_memory_utilization (memory %)
  - job:http_requests:rate5m (request rate per job)
```

### 5.2 Log Aggregation (Loki)

**Deployment:**
```yaml
Component: Loki (log storage)
Replicas: 1
Retention: 30 days (customizable per label)
Storage: 50Gi (NVMe)
Architecture: Single-mode (simple), not microservices

Distributor:
  - Receives logs from Promtail
  - Rate limiting: 10MB/sec per tenant
  
Ingester:
  - Batches logs into chunks
  - Chunk size: 4MB (compress + flush to storage)

Compactor:
  - Deduplicates + compresses old chunks
  - Cleanup job: runs hourly
```

**Log Collection (Promtail):**
```yaml
Component: Promtail (log shipper)
Deployment: DaemonSet (one per node)
Config:
  - Scrape all pod logs from /var/log/containers
  - Parse JSON logs (if structured)
  - Add labels: pod, namespace, node, app
  - Rate limiting: 1MB/sec per pod
```

**Log Levels & Retention:**
```yaml
ERROR logs: 90 days retention
WARN logs: 30 days retention
INFO logs: 7 days retention (development)
DEBUG logs: 24 hours retention (temporary)

Labels for retention:
  - Structured as: {cluster="vauban", namespace="prod", severity="ERROR"}
```

### 5.3 Distributed Tracing (Tempo)

**Deployment:**
```yaml
Component: Tempo (trace storage)
Replicas: 1
Retention: 30 days
Storage: 30Gi (NVMe)
Sample rate: 1% (to reduce storage; adjust based on volume)

Receivers:
  - OTLP gRPC (port 4317)
  - OTLP HTTP (port 4318)

Exporters:
  - Traces stored locally in chunks
  - Queryable via Grafana (Trace UI)
```

**Instrumentation:**
```yaml
SDK: OpenTelemetry SDK for supported languages
  - Frontend (TypeScript): @opentelemetry/sdk-node
  - Backend (Node.js): @opentelemetry/auto
  - Python workers: opentelemetry-distro

Exporters:
  - OTLP HTTP → http://otel-collector:4318/v1/traces

Spans captured:
  - HTTP requests (auto-instrumented)
  - Database queries
  - Redis calls
  - External API calls
  - Custom business events
```

**Sampling Strategy:**
```yaml
Head-based sampling:
  - Sample 100% of errors (critical for debugging)
  - Sample 10% of successful requests
  - Sample 100% of slow requests (duration > 1s)
  
Target: reduce trace volume from 100% to ~10-20%
```

### 5.4 Dashboards (Grafana)

**Deployment:**
```yaml
Component: Grafana
Replicas: 1
Storage: 10Gi (for dashboards, alerts, provisioning)
Version: 10.x (GA)
```

**Dashboard Strategy:**
```yaml
Dashboards:
  1. Cluster Overview (nodes, capacity, utilization)
  2. Application Health (frontend, API, worker status)
  3. Database Performance (replication lag, slow queries)
  4. Request Latency (p50, p95, p99 per endpoint)
  5. Blockchain Health (RPC latency, block height, indexer lag)
  6. Infrastructure Costs (CPU/memory utilization efficiency)

Data Sources:
  - Prometheus (metrics)
  - Loki (logs)
  - Tempo (traces)
  - Elasticsearch (search logs)
```

**Alerting Rules:**
```yaml
Rules (PrometheusRule CRD):
  1. pod-restart-rate > 5/hour → warning
  2. replication-lag > 100MB → critical
  3. http-error-rate > 5% → warning
  4. p99-latency > 1s → warning
  5. disk-space < 10% free → critical
  6. memory-usage > 90% → warning
```

**Alert Routing:**
```yaml
Alertmanager:
  - Routes alerts to multiple channels
  - Integrations: Slack, PagerDuty, email
  
Routing:
  - Severity=critical → PagerDuty (immediate)
  - Severity=warning → Slack #alerts
  - Severity=info → Grafana (visible only)
```

---

## 6. GITOPS & DEPLOYMENT STRATEGY

### 6.1 ArgoCD Configuration

**Deployment:**
```yaml
Component: ArgoCD
Namespace: argocd
Replicas:
  - API Server: 1 (single, critical component)
  - Controller: 1 (single, orchestrates syncs)
  - Dex (OIDC): 1 (optional, for auth)
  
Server exposure: Ingress (HTTPS only)
```

**Repository Configuration:**
```yaml
Git Repos (to be synced):
  1. vauban-infrastructure
     - K8s manifests for all components
     - Branch: main (prod), develop (staging)
     - Update policy: manual (approval-gated)
  
  2. vauban-app-frontend
     - Kustomization overlays per env
     - Image: vauban-frontend:v{GIT_COMMIT_SHA}
     - Syncs on image tag push

  3. vauban-app-backend
     - Similar structure to frontend
```

**Application Structure (Kustomize):**
```
vauban-infrastructure/
├── base/
│   ├── frontend/
│   ├── api/
│   ├── worker/
│   ├── postgres/
│   ├── redis/
│   └── observability/
│
├── overlays/
│   ├── production/
│   │   └── kustomization.yaml (prod resource limits, replicas)
│   └── staging/
│       └── kustomization.yaml (staging config, 1 replica)
│
└── sealed-secrets/
    └── (encrypted secrets for ArgoCD)
```

**Sync Strategy:**
```yaml
Auto-Sync: enabled (for low-risk components)
  - Observability stack (independent)
  - Ingress controller (stable)

Manual-Sync: disabled (for high-risk changes)
  - Frontend/API deployments (requires PR approval)
  - Database schema changes (requires manual review)
  
Pruning: enabled (remove resources deleted from git)
Self-Heal: enabled (revert manual changes in cluster)
```

### 6.2 Secrets Management

**Tool**: Sealed Secrets (by Bitnami)

**Flow:**
```
1. Developer creates secret.yaml (plaintext locally)
2. Run: kubeseal < secret.yaml > sealed-secret.yaml
3. Commit sealed-secret.yaml to git (encrypted)
4. ArgoCD syncs sealed-secret.yaml
5. K8s controller decrypts in-cluster (using sealing key)
```

**Sealing Key Rotation:**
```
- Sealing key stored in K8s secret (backed up to external vault)
- Rotation: every 90 days
- Old key: preserved for decrypting old secrets
- New key: used for new seals
```

**Secret Alternatives:**
```
Option 1: External Secrets Operator (ESO)
  - Integrates with HashiCorp Vault / AWS Secrets Manager
  - Auto-rotates secrets from external store
  - Recommended for sensitive production secrets

Option 2: Sealed Secrets (current)
  - Simpler, K8s-native, no external dependency
  - Suitable for non-critical secrets (API keys, DB passwords)
```

### 6.3 CI/CD Pipeline (GitHub Actions)

**Workflow Stages:**

```yaml
On Push to main:
  1. Unit Tests (5min)
     - Run Jest/Vitest
     - Coverage: maintain >80%
  
  2. Integration Tests (10min)
     - Spin up Docker Compose stack
     - Run API tests against live DB
  
  3. Build & Push Image (5min)
     - Build Dockerfile
     - Tag: {registry}/vauban-frontend:v{GIT_COMMIT_SHA}
     - Push to private registry (Docker Hub / ECR)
  
  4. Update Kustomization (1min)
     - Update base/frontend/kustomization.yaml
     - Change image tag to new SHA
     - Create PR or commit to develop branch
  
  5. ArgoCD Sync (2-5min)
     - Manual approval (for production)
     - ArgoCD detects git change
     - Syncs to K8s cluster
     - Runs post-deployment tests

On Pull Request:
  1. Lint (1min)
     - ESLint, Prettier
  
  2. Type Check (2min)
     - TypeScript compiler
  
  3. Security Scan (3min)
     - Snyk / Trivy for vulnerabilities
  
  4. Deployment Preview (5min)
     - Deploy to review environment
     - Comment PR with preview URL
```

**Deployment Frequency:**
```
Target: 5-10 deploys/day for frontend/API
Target: 1-2 deploys/week for infrastructure
Rollback time: <5min (revert git commit, ArgoCD syncs)
```

---

## 7. BLOCKCHAIN & NODE LAYER

### 7.1 Madara RPC Node Specifications

**Deployment Model:**
```yaml
Component: Madara (Starknet client, Rust-based)
Type: StatefulSet (maintains identity + state)
Replicas: 1 primary (add secondary for HA)
Image: madara:latest (build from starkware/madara)
Storage: 500Gi (blockchain state)
Network: Connect to Starknet L2 mainnet (testnet/sepolia for dev)
```

**Configuration:**
```yaml
Madara Args:
  --network: mainnet (or testnet/sepolia)
  --db-dir: /data/madara (PVC mount)
  --rpc-addr: 0.0.0.0:9944
  --p2p-addr: 0.0.0.0:30333 (P2P port, external traffic)
  --sync: fast (block sync from peers)

Resource Allocation:
  CPU: 2000m request, 4000m limit (heavy computation)
  Memory: 8Gi request, 16Gi limit (blockchain state cache)

Ports:
  - 9944: JSON-RPC (internal, exposed via nginx ingress)
  - 30333: P2P (libp2p for peer discovery)
```

**RPC Methods Exposed:**
```
starknet_blockNumber (get latest block)
starknet_getBlockByNumber (retrieve block data)
starknet_getTransactionByHash (get tx status)
starknet_call (read contract state)
starknet_estimateFee (gas estimation)

Rate Limits:
  - 1000 requests/min per IP (public RPC)
  - 10000 requests/min per authenticated JWT token
```

**Monitoring:**
```
Metrics to expose:
  - blockchain_block_height (Prometheus format)
  - blockchain_sync_status (syncing / synced)
  - blockchain_peer_count (connected peers)
  - rpc_call_duration_seconds (latency)
  - rpc_call_errors_total (failures)
```

### 7.2 Event Indexer Specifications

**Purpose:** Index smart contract events for fast querying

**Deployment:**
```yaml
Component: Vauban Event Indexer (custom service)
Type: Deployment (stateless, horizontal scalable)
Replicas: 1 (single consumer, maintains ordering)
Image: vauban-indexer:v{GIT_COMMIT_SHA}
Language: TypeScript / Python
Framework: TheGraph (Subgraph) or custom
```

**Architecture:**
```
Madara RPC
    ↓ (subscribe to events)
Event Indexer
    ↓ (parse events)
PostgreSQL (events table)
    ↓
Elasticsearch (full-text search on events)
    ↓
Grafana / Frontend (query indexed events)
```

**Indexing Strategy:**
```yaml
Smart Contracts Tracked:
  - Main contract (vauban-core)
  - Staking contract
  - Token contract
  - Governance contract

Events Indexed:
  - Transfer (erc20 transfers)
  - Stake / Unstake (staking events)
  - Proposal / Vote (governance events)
  - Custom business events

Storage:
  - PostgreSQL: events table (indexed on contract + event_type)
  - Elasticsearch: event_data (for free-text search)

Lag Monitoring:
  - indexer_lag_seconds (current height - indexed height)
  - Alert if lag > 10 blocks (~1 min)
```

**Data Freshness:**
```
Blockchain → Indexer → Frontend
  ~5 sec (block time) + ~2 sec (index latency) = ~7 sec total

Caching:
  - Redis cache for recent events (TTL: 1 hour)
  - Cold events queried from Elasticsearch
```

---

## 8. DISASTER RECOVERY & RESILIENCE

### 8.1 Backup Strategy (3-2-1 Rule)

**PostgreSQL Backups:**
```yaml
Backup Targets:
  1. Primary location: WAL-G to S3 (daily full + continuous WAL)
  2. Secondary: PostgreSQL replica (warm standby)
  3. Tertiary: External backup service (automated, multi-region)

Frequency:
  - Full backup: daily (2 AM UTC)
  - WAL archive: every 5 min (continuous streaming)
  - Point-in-time recovery (PITR): available for 30 days

Retention:
  - Full backups: 30 days
  - WAL archives: 30 days
  - Monthly backups: 6 months (long-term archive to Glacier)

Restore Time:
  - From replica: immediate (promote replica to primary)
  - From full backup: 30 min (restore from S3 + replay WAL)

Test Plan:
  - Monthly restore test (validate backups work)
  - Automated: trigger by CI/CD pipeline
```

**Redis Backups:**
```yaml
RDB Snapshots: daily (stored in PVC + S3)
AOF (Append-Only File): continuous (every operation)
Replication: streaming to replica node (instantaneous copy)

Recovery:
  - From replica: immediate
  - From RDB snapshot: <1 sec (load into memory)
  - Data loss window: <1 sec (AOF fsync: everysec)
```

**Application State Backups:**
```yaml
Elasticsearch Indices: snapshot to S3 (daily)
Kubernetes Secrets: backup to external vault
Git repositories: backed up to GitHub (redundant)
```

### 8.2 Disaster Recovery Procedures

**Scenario 1: PostgreSQL Primary Failure**
```
1. Automated detection: replication lag > 5 min for 2 checks
2. AlertManager triggers critical alert (PagerDuty)
3. On-call manually runs:
   kubectl exec postgres-replica -- psql -c "ALTER SYSTEM SET recovery_target = 'immediate'; SELECT pg_ctl_promote();"
4. Replica promoted to primary (write-enabled)
5. Applications reconnect to new primary
6. Restore old primary from backup (if needed)
RTO: 5 minutes (detection + manual action)
RPO: 0 (replication is synchronous)
```

**Scenario 2: Node Failure**
```
1. K8s detects kubelet heartbeat missing (40 sec default)
2. Pods marked for eviction
3. PVCs remain (data persists)
4. If PVC on failed node:
   - Manual: kubectl delete node {failed-node}
   - PVC stuck in "pending" state
   - Manual intervention: copy PVC to new node or restore from backup
5. If PVC on healthy node: auto-reschedule pod
RTO: 1 min (auto-detect), 30 min (PVC recovery)
RPO: <1 sec (if PVC on healthy node)
```

**Scenario 3: Kubernetes Etcd Corruption**
```
1. API server becomes unresponsive
2. Manual backup restore:
   - etcdctl snapshot restore --data-dir=/var/lib/rancher/k3s/server/db/etcd
   - Restart K3s api-server
3. All objects restored to backup point-in-time
RTO: 10 minutes (manual)
RPO: depends on backup frequency (recommend hourly)
```

**Scenario 4: Complete Cluster Failure**
```
1. Cannot recover (baremetal hardware failure)
2. Provisions new K3s cluster (fresh install: 30 min)
3. Restores from git (ArgoCD pulls manifests: 2 min)
4. Restores data (PostgreSQL from S3 backup: 30 min)
5. DNS updated to new cluster IP
RTO: 90 minutes (hardware + rebuild + data restore)
RPO: depends on backup frequency (recommend hourly for critical)
```

### 8.3 Resilience Patterns

**Circuit Breaker (for external API calls):**
```yaml
Pattern: Stop calling failing service after N errors
Implementation: Resilience4j (Java) or similar library
Config:
  - Failure threshold: 50% (50 errors per 100 calls)
  - Wait duration: 60 sec (after circuit opens)
  - Half-open state: 10 requests to test recovery
  
Effect: Prevents cascading failures; fast fallback
```

**Bulkhead (isolate resource pools):**
```yaml
Pattern: Separate thread pools / connection pools
Implementation: Per-endpoint thread pool sizes
Config:
  - API endpoint 1: 10 threads
  - API endpoint 2: 20 threads
  - Database: 50 connection pool
  
Effect: One slow endpoint doesn't starve others
```

**Retry with Exponential Backoff:**
```yaml
Pattern: Retry transient failures with increasing delay
Config:
  - Max retries: 3
  - Initial delay: 100 ms
  - Backoff multiplier: 2x (100ms, 200ms, 400ms)
  - Jitter: +/- 10% (prevents thundering herd)
  
Idempotency: All endpoints must be idempotent (safe to retry)
```

**Rate Limiting (protect from overload):**
```yaml
Strategies:
  1. Per-IP: 1000 requests/min (nginx middleware)
  2. Per-user: 10000 requests/min (application level)
  3. Per-endpoint: 500 requests/min (for expensive operations)

Implementation: Sliding window counter in Redis
Response: 429 Too Many Requests
```

### 8.4 Autoscaling Strategy

**Horizontal Pod Autoscaling (HPA):**
```yaml
Frontend HPA:
  - Metric: CPU utilization (70% threshold)
  - Min replicas: 3 (always available)
  - Max replicas: 10 (cost control)
  - Scale-up: 2 pods/min (fast to handle spikes)
  - Scale-down: 1 pod/5min (conservative, avoid flap)

API HPA:
  - Metric: CPU (75%) + custom metric (queue depth)
  - Min: 2, Max: 5
  
Worker HPA:
  - Custom metric: job queue length
  - Target: 10 jobs per worker (dynamic scaling)
```

**Vertical Pod Autoscaling (VPA) - Optional:**
```yaml
Purpose: Right-size resource requests
Mode: "recommendation" (no automatic scaling)
Benefits:
  - Learn correct CPU/memory from actual usage
  - Reduce reserved resources
  
Risk: Pod eviction (if CPU increased, needs reschedule)
Recommendation: Enable in staging, validate before prod
```

**Cluster Autoscaling:**
```yaml
Strategy: Add worker nodes if pods pending > 5 min
Tool: cluster-autoscaler or karpenter
Constraint: Max nodes = 10 (prevent runaway scaling)
```

---

## APPENDIX: Technology Decisions & Rationale

### A.1 Why These Technologies?

| Component | Choice | Rationale | Alternatives |
|-----------|--------|-----------|--------------|
| **K3s** | Production K3s | Lightweight, perfect for single datacenter + ArgoCD | EKS (cloud), bare Kubernetes (complex) |
| **Postgres** | Zalando Operator | HA automation + backups + monitoring | RDS (cloud), manual deployments (risky) |
| **Redis** | Cluster mode | HA + sharding for scale | Memcached (no persistence), AWS ElastiCache |
| **Elasticsearch** | Self-managed | Full control + cost efficiency | Elastic Cloud (managed, expensive) |
| **Prometheus** | Industry standard | CNCF maturity + extensive exporters | InfluxDB (proprietary), DataDog (expensive) |
| **Loki** | Lightweight logging | Efficient storage + Grafana native | ELK Stack (heavy), Splunk (expensive) |
| **Tempo** | OSS tracing | CNCF maturity + Grafana integration | Jaeger (more complex), Datadog (expensive) |
| **Grafana** | Unified dashboards | All-in-one (metrics + logs + traces) | Separate tools (complex), cloud platforms |
| **ArgoCD** | GitOps control | CNCF standard + declarative + auditable | Flux (equally good), manual deployments (risky) |
| **Sealed Secrets** | Secrets encryption | K8s-native + simple | Vault (complex setup), AWS Secrets Manager (cloud) |

### A.2 Cost Breakdown (Monthly Estimate)

```
Hardware: Amortized over 5 years
  - 8 CPU / 128GB / 3.5TB: ~$500/month (estimate)

Bandwidth: Egress to internet
  - Estimated: 5TB/month = ~$250/month (datacenter rates)

Storage (Object Storage if using S3):
  - Backups: 500GB = ~$10/month
  - Logs archive: 100GB = ~$5/month

External Services:
  - Pinata pinning (IPFS): $50-100/month (optional)
  - Cloudflare CDN (DDoS protection): $200/month (optional)

Total: ~$1000-1500/month all-in

ROI: If generating revenue > $1500/month → positive ROI
```

### A.3 Scalability Path (Year 2-3)

```
If traffic grows 10x:

1. Add Worker Nodes (K3s cluster becomes 3 nodes)
2. PostgreSQL: Promote read replicas, add connection pooling
3. Redis: Expand cluster (add more masters/replicas)
4. Elasticsearch: Add data nodes
5. Observability: Federate Prometheus (multi-cluster)
6. Consider: Multi-region Kubernetes (geo-redundancy)
7. Consider: Managed databases (RDS, managed PostgreSQL)
```

### A.4 Security Considerations

**Network Security:**
- Private K3s cluster (no public API server exposure)
- Ingress controller handles external traffic
- NetworkPolicies enforce zero-trust
- TLS for all inter-pod communication (optional, mTLS via service mesh)

**Data Security:**
- Encryption at rest (PVC encryption, database SSL)
- Encryption in transit (TLS for all connections)
- Secrets rotation (every 90 days)
- Database backups encrypted (AES-256)

**Access Control:**
- RBAC for K8s API access (limited per role)
- Pod Security Policies (no privileged containers)
- Audit logging (K8s API audit, application logs)
- SSH key rotation for node access

**Supply Chain Security:**
- Container image scanning (Trivy, Snyk)
- Signed commits (git GPG signing)
- Dependency scanning (Dependabot, Snyk)
- SBOMs (Software Bill of Materials) for compliance

---

## CONCLUSION

This specification document defines a **production-grade, declarative infrastructure** suitable for Vauban Blog with 8 CPU / 128GB / 3.5TB hardware.

Key strengths:
- ✅ GitOps automation (ArgoCD + k8s manifests)
- ✅ Comprehensive observability (metrics + logs + traces)
- ✅ High availability patterns (replicas, failover, backups)
- ✅ Cost-efficient (self-managed, no cloud lock-in)
- ✅ Scalable path (can grow to multi-region)

Next steps:
1. Review this spec with team
2. Prioritize implementations (e.g., Madara RPC first, indexer second)
3. Establish deployment schedule (phased rollout)
4. Document operational playbooks per scenario
5. Conduct disaster recovery tests monthly

---

**Document History:**
- v1.0 (Dec 2025): Initial architecture sketch
- v2.0 (Jan 2026): Comprehensive specs + technology decisions
