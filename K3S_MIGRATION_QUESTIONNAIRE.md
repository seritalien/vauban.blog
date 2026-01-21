# Questionnaire - Migration vers K3S (Phase B)

Ce document liste toutes les informations necessaires avant de demarrer la migration de Docker Compose vers K3S.

**STATUT: MIGRATION COMPLETEE - Infrastructure K3S operationnelle**

---

## Informations Generales

### 1. Infrastructure Serveur

- **Nombre de noeuds disponibles** : 1 noeud (single-node cluster)
  - [x] 1 noeud (single-node cluster)
  - [ ] 3 noeuds (HA recommande)
  - [ ] 5+ noeuds (production multi-zone)

- **Specifications par noeud** :
  - CPU : 16 cores / 32 threads (AMD Ryzen 9 5950X)
  - RAM : 128 GB DDR4 ECC
  - Disk : 3500 GB (3.5 TB) - 2x SSD U.2 NVMe 3.84 TB Datacenter
  - OS : Linux 6.8.0-88-generic (Ubuntu)

- **Reseau** :
  - [x] Tous les noeuds sont dans le meme reseau local
  - [ ] Noeuds distribues geographiquement
  - Bande passante inter-noeuds : N/A (single node)
  - Latence moyenne : N/A (single node)

### 2. Objectifs de la Migration

Cochez vos priorites (1 = plus important, 5 = moins important):

- [ ] **High Availability (HA)** - Pas de downtime en cas de panne noeud
  Priorite : 4/5 (single node actuellement)

- [x] **Scalabilite horizontale** - Ajouter des noeuds facilement
  Priorite : 3/5

- [x] **Auto-healing** - Redemarrage automatique des pods defaillants
  Priorite : 1/5

- [x] **Rolling updates** - Mises a jour sans downtime
  Priorite : 1/5

- [x] **Resource limits** - Meilleure isolation et quotas
  Priorite : 2/5

- [x] **Observability** - Meilleure visibilite sur l'infrastructure
  Priorite : 1/5

### 3. Timeline

- **Date de debut souhaitee** : Complete
- **Date de mise en production cible** : Complete
- **Fenetre de maintenance disponible** :
  - Jour(s) : Flexible (projet personnel)
  - Heure : N/A
  - Duree maximale acceptable : N/A
  - Downtime total acceptable : N/A (staging/dev)

---

## Donnees et Persistance

### 4. PostgreSQL (TimescaleDB)

- **Taille actuelle de la base** : 50 GB (staging), 150 GB (production)
- **Croissance estimee mensuelle** : Variable (indexer events)
- **Nombre de connexions simultanees** : 100 (max_connections)
- **Criticite des donnees** :
  - [x] Critique (perte inacceptable)
  - [ ] Importante (perte max 1h acceptable)
  - [ ] Normale (perte max 24h acceptable)

**Strategie de haute disponibilite** :
- [ ] CloudNativePG (HA native Kubernetes - recommande)
- [ ] PostgreSQL Streaming Replication
- [ ] Patroni + etcd
- [x] Single instance avec backups (implementee via CronJob)

**Backups** :
- Frequence souhaitee :
  - [ ] Continue (WAL shipping)
  - [ ] Toutes les heures
  - [x] Quotidien (via postgresql-backup-cronjob.yaml)
  - [ ] Hebdomadaire
- Retention : 7 jours (configurable)
- Destination :
  - [x] S3/MinIO (Hetzner Storage Box via rclone)
  - [ ] NFS
  - [ ] Autre : ___________

### 5. Redis (Queue/Cache)

- **Taille actuelle des donnees** : < 200 MB (maxmemory limit)
- **Utilisation memoire moyenne** : ~100 MB
- **Nombre de clients connectes** : Backend API (1 deployment)

**Strategie de haute disponibilite** :
- [ ] Redis Sentinel (3+ sentinels - recommande pour K3S)
- [ ] Redis Cluster (6+ noeuds)
- [x] Single instance (pas de HA)
- [ ] Redis Enterprise (commercial)

**Persistance** :
- [ ] AOF (durabilite maximale)
- [ ] RDB (snapshots periodiques)
- [x] AOF + RDB (hybride - configure dans redis.conf)
- [ ] Aucune (cache volatile)

### 6. Volumes de Donnees

Pour chaque service, indiquez les besoins de stockage :

| Service | Taille actuelle | Type stockage souhaite | Backup requis |
|---------|-----------------|------------------------|---------------|
| PostgreSQL staging | 50 GB | PVC local-path | Oui |
| PostgreSQL prod | 150 GB | PVC local-path | Oui |
| Grafana dashboards | 10 GB | PVC local-path | Non (ConfigMaps) |
| Prometheus metrics | 50 GB | PVC local-path | Non |
| Tempo traces | 20 GB | PVC local-path | Non |
| Loki logs | 40 GB | PVC local-path | Non |
| Redis data | 5 GB | PVC local-path | Non |
| MinIO (DNA storage) | 50 GB | PVC local-path | Non |
| etcd (DNA coord) | 10 GB | PVC local-path | Non |
| Pathfinder mainnet | ~1.5 TB | PVC local-path | Non |
| Pathfinder sepolia | ~500 GB | PVC local-path | Non |

**Storage Class disponible** :
- [x] Local-path (defaut K3S) - UTILISE
- [ ] NFS
- [ ] Ceph/Rook
- [ ] Longhorn (distribue)
- [ ] Cloud provider (AWS EBS, GCE PD, etc.)
- [ ] Autre : ___________

---

## Reseau et Ingress

### 7. DNS et Domaines

- **Wildcard DNS configure** :
  - [x] Oui : `*.vauban.tech` -> IP du serveur Hetzner
  - [ ] Non, DNS individuels par service

- **Certificats SSL** :
  - [x] Let's Encrypt (automatique via cert-manager)
  - [ ] Certificats existants (a importer)
  - [ ] Wildcard certificate
  - [ ] Sans SSL (dev uniquement)

### 8. Ingress Controller

- **Choix d'Ingress** :
  - [x] Traefik (defaut K3S - UTILISE)
  - [ ] NGINX Ingress Controller
  - [ ] Istio (service mesh complet)
  - [ ] Kong (API gateway)

- **LoadBalancer externe** :
  - [ ] MetalLB (bare metal)
  - [ ] Cloud provider LB
  - [x] ServiceLB (defaut K3S - svclb)
  - [ ] Autre : ___________

### 9. Service Mesh (Optionnel)

- **Besoin d'un service mesh** :
  - [ ] Oui (Istio, Linkerd)
  - [x] Non (pas necessaire pour l'instant)

Si oui, pour quelles fonctionnalites :
- [ ] mTLS automatique entre services
- [ ] Traffic management avance (canary, blue/green)
- [ ] Observability amelioree (traces, metriques)
- [ ] Circuit breaking et retries

---

## Securite et Acces

### 10. Gestion des Secrets

- **Methode de gestion des secrets** :
  - [ ] Kubernetes Secrets (base64 - pas recommande production)
  - [x] Sealed Secrets (chiffrement via certificat) - UTILISE
  - [ ] External Secrets Operator + Vault
  - [ ] SOPS (chiffrement fichiers)
  - [ ] Cloud provider (AWS Secrets Manager, etc.)

- **Secrets existants a migrer** :
  - [x] Oui, depuis `.env` Docker Compose (migration completee)
  - [ ] Oui, depuis un vault externe
  - [ ] Non, regenerer tous les secrets

### 11. RBAC et Acces

- **Utilisateurs/equipes necessitant l'acces au cluster** :
  - Nombre de personnes : 1 (projet personnel)
  - Roles necessaires :
    - [x] Admin cluster (full access)
    - [ ] Developpeurs (deploy dans certains namespaces)
    - [ ] Lecteurs (read-only)
    - [x] CI/CD (automation) - GitHub Actions ARC Runners

- **Authentification preferee** :
  - [x] Certificats (kubeconfig)
  - [ x] OIDC (Google, GitHub, Azure AD)
  - [ ] LDAP/Active Directory
  - [x] Service Accounts (pour CI/CD)

### 12. Network Policies

- **Isolation reseau souhaitee** :
  - [ ] Oui, isolation stricte entre namespaces
  - [x] Partiel, certains services doivent communiquer (implementee)
  - [ ] Non, tous les pods peuvent se parler

- **Regles specifiques** :
  - [ ] Bloquer l'acces Internet sortant pour certains pods
  - [ ] Whitelist des IPs autorisees
  - [x] Segmentation par environnement (dev/staging/prod) - namespaces separes

---

## Monitoring et Observability

### 13. Stack Prometheus/Grafana Existante

**Votre infrastructure actuelle** :
- Prometheus installe sur : Namespace observability (kube-prometheus-stack)
  - Version : Via Helm chart prometheus-community/kube-prometheus-stack
  - Storage retention : 30 jours (45GB max)
  - Remote write active : Oui (pour Tempo metrics)

- Grafana installe sur : Namespace observability (via kube-prometheus-stack)
  - Version : Incluse dans helm chart
  - Nombre de dashboards : 3 tiers (Executive, Application, Infrastructure)
  - Datasources configures : 7 (Prometheus, Alertmanager, Loki, Tempo, PostgreSQL x3)

**Integration K3S** :
- [x] Prometheus scrape les metriques K3S (kubelet, api-server, etc.)
- [x] ServiceMonitor CRDs (Prometheus Operator)
- [ ] Federation Prometheus (multi-cluster)
- [x] Remote write vers Prometheus central (Tempo metrics generator)

### 14. Logs Centralises

**Votre stack Loki/Promtail** :
- Loki installe sur : Namespace observability
  - Retention : 30 jours (720h)
  - Storage : PVC local-path 40Gi (SingleBinary mode)

**Integration K3S** :
- [x] Promtail DaemonSet pour collecter logs pods
- [ ] Fluentd/Fluent Bit a la place
- [ ] Logs uniquement via `kubectl logs`

### 15. Tracing Distribue

- **Garder Tempo dans K3S** :
  - [x] Oui, deployer Tempo dans le cluster (FAIT)
  - [ ] Non, utiliser une instance externe
  - [ ] Migrer vers Jaeger
  - [ ] Pas de tracing necessaire

---

## CI/CD et GitOps

### 16. Deploiement des Applications

- **Methode de deploiement preferee** :
  - [x] GitOps (ArgoCD / FluxCD - recommande) - ArgoCD UTILISE
  - [x] Helm charts (pour observability stack)
  - [x] Kustomize (pour applications Vauban)
  - [ ] kubectl apply -f manifests/
  - [x] CI/CD existant (GitHub Actions) - ARC self-hosted runners

- **Repository Git** :
  - [x] Continuer avec le repo actuel (mono-repo)
  - [ ] Creer un repo dedie pour manifests K8S
  - Structure souhaitee :
    - [x] Mono-repo (tout dans un repo) - UTILISE
    - [ ] Multi-repo (1 repo par app)

### 17. Registry Docker

- **Images Docker** :
  - [ ] Docker Hub public
  - [ ] Registry prive existant : ___________
  - [ ] Harbor (a deployer)
  - [x] GitHub Container Registry (ghcr.io) - UTILISE
  - [ ] Cloud provider registry

- **Image pull secrets** :
  - [x] Requis pour registry prive (ghcr-secret)
  - [ ] Non necessaire (images publiques)

---

## Migration Strategy

### 18. Approche de Migration

**Quelle strategie preferez-vous** :

- [ ] **Big Bang** (tout migrer en une fois)
  - Avantage : Plus rapide
  - Inconvenient : Downtime plus long, plus risque

- [x] **Strangler Pattern** (service par service) - UTILISE
  - Avantage : Risque limite, rollback facile
  - Inconvenient : Plus long, gestion hybride

- [ ] **Blue/Green** (nouveau cluster en parallele)
  - Avantage : Pas de downtime, rollback instantane
  - Inconvenient : Double infrastructure temporaire

**Ordre de migration souhaite** (COMPLETE):
1. K3S + ArgoCD setup
2. Observability stack (Prometheus, Grafana, Loki, Tempo)
3. PostgreSQL + Redis
4. Backend + Frontend + Indexer
5. Pathfinder nodes (Sepolia + Mainnet) : A NE JAMAIS ARRETER DANS CONSENTEMENT TRES EXPLICITE

### 19. Tests et Validation

- **Environnement de test** :
  - [ ] Creer un cluster K3S de test d'abord
  - [ ] Tester directement en production
  - [x] Utiliser un namespace dedie (vauban-staging vs vauban-prod) utiliser des namespaces dédiés pour les applications que l'on migre  soyons rationnel , propose moi d'abord 

- **Criteres de validation** :
  - [x] Tous les services sont "Running"
  - [x] Health checks passent
  - [x] Tests E2E passent (CI/CD)
  - [x] Performance equivalente a Docker Compose
  - [x] Autre : ArgoCD sync status Healthy/Synced

### 20. Rollback Plan

- **En cas de probleme, rollback vers** :
  - [ ] Docker Compose (garder en standby)
  - [x] Snapshots K3S / Git revert
  - [x] Backups de donnees uniquement (PostgreSQL CronJob)

- **Criteres de rollback** :
  - Downtime > 30 minutes
  - Erreur rate > 5 %
  - Perte de donnees : Non tolere
  - Autre : ArgoCD Degraded status

---

## Services Specifiques

### 21. Supabase Stack

**Deploiement Supabase** :
- [x] Utiliser les Helm charts officiels Supabase
- [ ] Convertir docker-compose en manifests K8S custom
- [ ] Utiliser Supabase Cloud (hosted)
- [ ] N/A - Utilisation directe de PostgreSQL/TimescaleDB

**Services a deployer** :
- [x] Tous (Kong, Auth, Storage, Realtime, etc.) sachant que des instances de postgresql, redis et minio sont déja utilisé par la dapp vauban.tech (stacking sur starknet) en production et staging
- [ ] Seulement certains :

### 22. n8n

**Scalabilite n8n** :
-  [x] Auto-scaling (HPA) basé sur queue length
 **Shared storage pour workflows** :
  - [x] PVC (Persistent Volume)
  - [x] S3-compatible storage : minio disponible si besoin
  prends la mielleure des deux solutions

### 23. Observability Stack

**Deploiement dans K3S** :
- [x] Prometheus Operator (kube-prometheus-stack) - DEPLOYE
- [ ] Standalone Prometheus
- [ ] Utiliser uniquement l'instance externe

- [x] Grafana dans le cluster - DEPLOYE (monitoring.vauban.tech)
- [ ] Utiliser uniquement l'instance externe

- [x] Tempo dans le cluster - DEPLOYE
- [ ] Jaeger
- [ ] Pas de tracing

---

## Outils et Preferences

### 24. Outils de Gestion K3S

- **CLI preferes** :
  - [x] kubectl
  - [x] k9s (TUI)
  - [ ] Lens (GUI)
  - [ ] Rancher UI
  - [ ] Portainer

- **Helm** :
  - [ ] Oui, utiliser Helm pour tous les deploiements
  - [x] Seulement pour certains services (observability stack, cert-manager)
  - [ ] Non, raw manifests uniquement

### 25. Addons K3S

Quels addons K3S souhaitez-vous :

- [x] **Traefik** (ingress controller - installe par defaut) - ACTIF
- [x] **ServiceLB** (load balancer - installe par defaut) - ACTIF
- [x] **local-path-provisioner** (storage - installe par defaut) - ACTIF
- [x] **Metrics Server** (pour HPA) - ACTIF
- [ ] Desactiver les addons par defaut (utiliser custom)

**Addons supplementaires instllé ** :
- [x] cert-manager (Let's Encrypt) - INSTALLE
- [ ] external-dns (DNS automation)
- [ ] Longhorn (distributed storage)
- [ ] MetalLB (bare metal LB)
- [x] Autre : Sealed Secrets, ArgoCD, ARC Runners INSTALLE

---

## Budget et Ressources

### 26. Contraintes Budgetaires

- **Budget mensuel infrastructure** : ~60 EUR/mois (Hetzner Auction server)
- **Budget outils/licences** : 0 EUR/mois
- **Preference** :
  - [x] Open source uniquement
  - [ ] Mix open source + commercial
  - [ ] Peu importe si ca resout le besoin

### 27. Ressources Humaines

- **Expertise K8S dans l'equipe** :
  - [x] Expert (deja gere des clusters production)
  - [ ] Intermediaire (connaissance theorique)
  - [ ] Debutant (premiere fois)

- **Temps disponible pour la migration** :
  - Variable heures/semaine (projet personnel)
  - Sur N/A semaines (complete)

- **Formation necessaire** :
  - [ ] Oui, K8S fundamentals
  - [ ] Oui, K8S avance
  - [x] Non, deja formes

---

## Support et Documentation

### 28. Support

- **En cas de probleme** :
  - [x] Support communautaire (forums, Slack)
  - [ ] Support payant (Rancher, Red Hat)
  - [ ] Consultant externe
  - [x] Autonomie complete

### 29. Documentation

- **Format de documentation souhaite** :
  - [x] Runbooks detailles (Markdown) - docs/ directory
  - [x] Diagrammes d'architecture
  - [ ] Videos de formation
  - [ ] Wiki interne
  - [ ] Tout ce qui precede

---

## Checklist Pre-Migration

Avant de commencer, vous devez avoir :

- [x] Backups complets de toutes les donnees
- [x] Tests de restauration valides
- [x] Serveur(s) K3S installe et accessible
- [x] Acces SSH aux noeuds
- [x] DNS configure ou plan DNS pret (*.vauban.tech)
- [x] Secrets identifies et documentes (Sealed Secrets)
- [x] Fenetre de maintenance approuvee
- [x] Plan de rollback documente
- [x] Monitoring existant operationnel

---

## Notes et Questions Additionnelles

```
Infrastructure K3S completement operationnelle depuis fin 2025.

Namespaces actifs:
- argocd: ArgoCD GitOps
- observability: Prometheus, Grafana, Loki, Tempo, AlertManager
- vauban-staging: Application staging (Sepolia testnet)
- vauban-prod: Application production (Mainnet)
- starknet-node: Pathfinder nodes (Sepolia + Mainnet + Validator)
- cert-manager: TLS certificates
- arc-systems/arc-runners: GitHub Actions self-hosted runners

URLs publiques:
- https://vauban.tech (production)
- https://staging.vauban.tech (staging)
- https://pr-XXX.preview.vauban.tech (PR previews)
- https://monitoring.vauban.tech (Grafana)
- https://argocd.vauban.tech (ArgoCD)
- https://sepolia.rpc.vauban.tech (Pathfinder Sepolia RPC)
- https://mainnet.rpc.vauban.tech (Pathfinder Mainnet RPC)
```

---

## Migration Guide for New Applications

This section provides comprehensive information for migrating Docker Compose applications to this K3S cluster.

### 1. Namespaces

Current namespaces in the cluster:

| Namespace | Purpose | Status |
|-----------|---------|--------|
| `arc-systems` | GitHub Actions Runner Controller | Active |
| `argocd` | ArgoCD GitOps | Active |
| `automation` | Automation tools (n8n, etc.) | Active |
| `cert-manager` | TLS certificate management | Active |
| `default` | Default namespace (unused) | Active |
| `kube-node-lease` | Node heartbeat | System |
| `kube-public` | Public resources | System |
| `kube-system` | K3S system components (Traefik, CoreDNS) | System |
| `kyverno` | Policy engine | Active |
| `observability` | Prometheus, Grafana, Loki, Tempo | Active |
| `sealed-secrets` | Sealed Secrets controller | Active |
| `starknet-node` | Pathfinder nodes (Mainnet + Sepolia) | Active |
| `vauban-pr-*` | Preview environments (per PR) | Dynamic |
| `vauban-prod` | Production application | Active |
| `vauban-staging` | Staging application | Active |

**Creating a new namespace:**
```bash
# Via manifest (recommended for GitOps)
kubectl create namespace my-app --dry-run=client -o yaml > namespace.yaml

# Include in kustomization.yaml resources
```

### 2. Resource Quotas

Resource quotas enforce limits per namespace. Current quotas:

| Namespace | CPU Request/Limit | Memory Request/Limit | Storage | PVCs | Pods |
|-----------|------------------|---------------------|---------|------|------|
| `automation` | 4/8 cores | 8Gi/32Gi | - | - | - |
| `observability` | 6/20 cores | 20Gi/32Gi | 200Gi | 15 | 50 |
| `starknet-node` | 8/12 cores | 48Gi/56Gi | 2Ti | 5 | 10 |
| `vauban-prod` | 8/16 cores | 32Gi/48Gi | 500Gi | 20 | 50 |
| `vauban-staging` | 4/8 cores | 16Gi/24Gi | 300Gi | 25 | - |

**Example ResourceQuota for new application:**
```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: my-app-quota
  namespace: my-app
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    requests.storage: 100Gi
    persistentvolumeclaims: "10"
    pods: "20"
    services: "10"
```

### 3. LimitRanges

LimitRanges set default and max limits per container. Current configuration:

| Namespace | CPU Min/Max | Memory Min/Max | Default Request | Default Limit |
|-----------|-------------|----------------|-----------------|---------------|
| `vauban-prod` | 10m/4 cores | 16Mi/8Gi | 100m CPU, 128Mi | 500m CPU, 512Mi |
| `vauban-staging` | 10m/2 cores | 16Mi/4Gi | 50m CPU, 64Mi | 250m CPU, 256Mi |
| `automation` | 10m/4 cores | 16Mi/8Gi | 100m CPU, 128Mi | 500m CPU, 512Mi |
| `observability` | varies | varies | varies | varies |
| `starknet-node` | 10m/4 cores | 16Mi/8Gi | 100m CPU, 128Mi | 500m CPU, 512Mi |

**Example LimitRange for new application:**
```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: container-limits
  namespace: my-app
spec:
  limits:
  - type: Container
    min:
      cpu: 10m
      memory: 16Mi
    max:
      cpu: 2
      memory: 4Gi
    default:
      cpu: 250m
      memory: 256Mi
    defaultRequest:
      cpu: 50m
      memory: 64Mi
```

### 4. PodDisruptionBudgets (PDB)

PDBs ensure minimum availability during voluntary disruptions (node drain, upgrades).

**Current PDBs pattern:**
```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: my-app-pdb
  namespace: my-app
spec:
  minAvailable: 1  # At least 1 pod must be available
  selector:
    matchLabels:
      app: my-app
```

**Best practices:**
- Production: `minAvailable: 1` (or 50% for HA)
- Staging: `minAvailable: 1`
- StatefulSets (databases): Always set `minAvailable: 1`

### 5. Storage Classes

**Available storage class:**

| Name | Provisioner | Reclaim Policy | Volume Binding | Expansion |
|------|-------------|----------------|----------------|-----------|
| `local-path` (default) | rancher.io/local-path | Delete | WaitForFirstConsumer | No |

**PVC Example:**
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-app-data
  namespace: my-app
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: local-path  # Optional, uses default
  resources:
    requests:
      storage: 10Gi
```

**Important notes:**
- `local-path` stores data on node's local disk (`/var/lib/rancher/k3s/storage/`)
- Data is node-bound (not replicated)
- For HA, consider Longhorn or external storage
- Volume expansion NOT supported - resize requires migration

### 6. Ingress Configuration

**Ingress Controller:** Traefik (K3S default)

**Current ingress patterns:**

| Domain | Namespace | Service | TLS |
|--------|-----------|---------|-----|
| `vauban.tech`, `www.vauban.tech` | vauban-prod | frontend:3000 | Yes |
| `api.vauban.tech` | vauban-prod | backend:3001 | Yes |
| `staging.vauban.tech` | vauban-staging | frontend:3000 | Yes |
| `api.staging.vauban.tech` | vauban-staging | backend:3001 | Yes |
| `pr-XXX.preview.vauban.tech` | vauban-pr-XXX | frontend:3000 | Yes |
| `monitoring.vauban.tech` | observability | grafana:80 | Yes |
| `argocd.vauban.tech` | argocd | argocd-server:443 | Yes |
| `rpc.vauban.tech` | starknet-node | pathfinder-mainnet:9545 | Yes |
| `sepolia.rpc.vauban.tech` | starknet-node | pathfinder-sepolia:9545 | Yes |

**Ingress Template:**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app-ingress
  namespace: my-app
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
spec:
  ingressClassName: traefik
  tls:
  - hosts:
    - my-app.vauban.tech
    secretName: my-app-tls
  rules:
  - host: my-app.vauban.tech
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: my-app
            port:
              number: 3000
```

**cert-manager ClusterIssuer:** `letsencrypt-prod` (automatic Let's Encrypt certificates)

### 7. Network Policies

Network policies implement defense-in-depth network segmentation.

**Current patterns:**

```yaml
# Default: Pods can communicate within namespace
# Explicit rules needed for cross-namespace traffic

# Example: Allow ingress from Traefik only
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: my-app-network-policy
  namespace: my-app
spec:
  podSelector:
    matchLabels:
      app: my-app
  policyTypes:
  - Ingress
  ingress:
  # Allow from Traefik (external traffic)
  - from:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
      podSelector:
        matchLabels:
          app.kubernetes.io/name: traefik
    ports:
    - protocol: TCP
      port: 3000
  # Allow Prometheus scraping
  - from:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: observability
    ports:
    - protocol: TCP
      port: 9090  # metrics port
```

**Common patterns:**
- Frontend: Allow from Traefik only
- Backend: Allow from Traefik + frontend pods + indexer pods
- Database: Allow from backend + indexer only
- Redis: Allow from backend only

**Note:** K3s has known issues with cross-namespace NetworkPolicy enforcement. Test thoroughly.

### 8. ServiceMonitors (Prometheus Integration)

ServiceMonitors tell Prometheus how to scrape your application metrics.

**Required labels for discovery:**
```yaml
release: kube-prometheus-stack  # REQUIRED
```

**ServiceMonitor Template:**
```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-app
  namespace: my-app  # Same namespace as app
  labels:
    app: my-app
    release: kube-prometheus-stack  # REQUIRED for discovery
spec:
  selector:
    matchLabels:
      app: my-app
  namespaceSelector:
    matchNames:
    - my-app
  endpoints:
  - port: http          # Must match Service port name
    path: /metrics      # Metrics endpoint path
    interval: 30s       # Scrape interval
    scrapeTimeout: 10s
```

**Service must expose metrics port:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app
  labels:
    app: my-app
spec:
  ports:
  - name: http      # Referenced by ServiceMonitor
    port: 3000
  - name: metrics   # Optional dedicated metrics port
    port: 9090
  selector:
    app: my-app
```

### 9. PrometheusRules (Alerting)

PrometheusRules define alerting rules for your application.

**Required labels for discovery:**
```yaml
release: kube-prometheus-stack
prometheus: kube-prometheus-stack
role: alert-rules
```

**PrometheusRule Template:**
```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: my-app-alerts
  namespace: observability  # Must be in observability namespace
  labels:
    app.kubernetes.io/name: my-app-alerts
    release: kube-prometheus-stack
    prometheus: kube-prometheus-stack
    role: alert-rules
spec:
  groups:
  - name: my-app.rules
    interval: 60s
    rules:
    # Service down alert
    - alert: MyAppDown
      expr: up{job="my-app"} == 0
      for: 5m
      labels:
        severity: critical
        component: my-app
      annotations:
        summary: "My App is down"
        description: "My App {{ $labels.instance }} unreachable for 5 minutes"
        runbook_url: "https://docs.example.com/runbooks/my-app-down"

    # High latency alert
    - alert: MyAppHighLatency
      expr: |
        histogram_quantile(0.95,
          rate(http_request_duration_seconds_bucket{job="my-app"}[5m])
        ) > 2
      for: 10m
      labels:
        severity: warning
        component: my-app
      annotations:
        summary: "My App high latency"
        description: "95th percentile latency > 2s for 10 minutes"

    # High error rate alert
    - alert: MyAppHighErrorRate
      expr: |
        (
          rate(http_requests_total{job="my-app", status_code=~"5.."}[5m])
          / rate(http_requests_total{job="my-app"}[5m])
        ) > 0.05
      for: 5m
      labels:
        severity: warning
        component: my-app
      annotations:
        summary: "My App high error rate"
        description: "Error rate > 5% for 5 minutes"
```

**Apply alerts:**
```bash
kubectl apply -f my-app-alerts.yaml
# Verify discovery
kubectl get prometheusrule -n observability | grep my-app
```

### 10. CI/CD Integration

#### GitHub Actions Workflow Pattern

**Staging deployment workflow** (triggered after CI passes):

```yaml
name: Staging Deploy

on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_PREFIX: ghcr.io/${{ github.repository_owner }}

jobs:
  build:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    runs-on: arc-runner-set  # Self-hosted runner
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: ./my-app
          push: true
          tags: |
            ${{ env.IMAGE_PREFIX }}/my-app:staging
            ${{ env.IMAGE_PREFIX }}/my-app:staging-${{ github.sha }}
          cache-from: type=gha,scope=my-app-staging
          cache-to: type=gha,scope=my-app-staging,mode=max

  update-manifests:
    needs: build
    runs-on: arc-runner-set
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Update manifests
        run: |
          SHA="${{ github.sha }}"
          sed -i "s|image: ghcr.io/.*/my-app:staging.*|image: ghcr.io/${{ github.repository_owner }}/my-app:staging-$SHA|" \
            k8s/k8s/staging/my-app-deployment.yaml

      - name: Commit and push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add k8s/
          git diff --staged --quiet || git commit -m "chore(k8s): update my-app staging [${{ github.sha }}]"
          git push
```

#### ArgoCD Application Pattern

**ArgoCD Application for GitOps deployment:**

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app-staging
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/YOUR_ORG/YOUR_REPO.git
    targetRevision: main
    path: k8s/k8s/my-app/staging
    kustomize: {}
  destination:
    server: https://kubernetes.default.svc
    namespace: my-app-staging
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - PrunePropagationPolicy=foreground
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas
```

#### Kustomization Structure

**Recommended directory structure:**
```
k8s/
  k8s/
    my-app/
      staging/
        kustomization.yaml
        00-sealed-secrets.yaml
        01-configmaps.yaml
        deployment.yaml
        service.yaml
        ingress.yaml
        servicemonitor.yaml
        network-policies.yaml
        pod-disruption-budgets.yaml
      production/
        kustomization.yaml
        # ... same structure
```

**kustomization.yaml example:**
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: my-app-staging

resources:
  - 00-sealed-secrets.yaml
  - 01-configmaps.yaml
  - deployment.yaml
  - service.yaml
  - ingress.yaml
  - servicemonitor.yaml
  - network-policies.yaml
  - pod-disruption-budgets.yaml

images:
  - name: ghcr.io/YOUR_ORG/my-app
    newTag: staging
```

### 11. Secret Management (Sealed Secrets)

Sealed Secrets encrypt secrets for safe storage in Git.

**Installation check:**
```bash
kubectl get pods -n sealed-secrets
```

**Creating a Sealed Secret:**

```bash
# 1. Create plain secret (DO NOT commit this!)
kubectl create secret generic my-app-secrets \
  --namespace my-app-staging \
  --from-literal=DATABASE_URL='postgresql://user:pass@host:5432/db' \
  --from-literal=API_KEY='secret-key' \
  --dry-run=client -o yaml > secret.yaml

# 2. Seal the secret
kubeseal --format yaml < secret.yaml > sealed-secret.yaml

# 3. Delete plain secret
rm secret.yaml

# 4. Commit sealed-secret.yaml to Git
```

**Sealed Secret structure:**
```yaml
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: my-app-secrets
  namespace: my-app-staging
spec:
  encryptedData:
    DATABASE_URL: AgCuk/u7t42Z... # Encrypted
    API_KEY: AgAM+s1v8m5w...      # Encrypted
  template:
    metadata:
      name: my-app-secrets
      namespace: my-app-staging
```

**Using secrets in deployment:**
```yaml
spec:
  containers:
  - name: my-app
    envFrom:
    - secretRef:
        name: my-app-secrets
```

### 12. Image Registry (ghcr.io)

**Pull secret creation:**
```bash
# Create GitHub PAT with packages:read scope
kubectl create secret docker-registry ghcr-secret \
  --namespace my-app-staging \
  --docker-server=ghcr.io \
  --docker-username=YOUR_GITHUB_USERNAME \
  --docker-password=YOUR_GITHUB_PAT \
  --docker-email=your@email.com
```

**Using pull secret in deployment:**
```yaml
spec:
  imagePullSecrets:
  - name: ghcr-secret
  containers:
  - name: my-app
    image: ghcr.io/YOUR_ORG/my-app:staging
```

**Image tagging convention:**
- `staging` - Latest staging build
- `staging-<sha>` - Immutable SHA-tagged staging
- `prod` - Latest production build
- `prod-<sha>` - Immutable SHA-tagged production
- `pr-<number>` - Preview environment build

### 13. Observability Standards

#### Logging (Loki)

**Expected log format:** JSON structured logs

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "info",
  "message": "Request processed",
  "service": "my-app",
  "trace_id": "abc123",
  "span_id": "def456",
  "request_id": "req-789",
  "duration_ms": 45
}
```

**Promtail automatically collects:**
- All container stdout/stderr
- Labels from pod metadata (namespace, pod, container)

**Query in Grafana:**
```logql
{namespace="my-app-staging", app="my-app"} |= "error"
```

#### Tracing (Tempo with OpenTelemetry)

**OTLP endpoint:** `http://tempo.observability.svc:4318` (HTTP) or `:4317` (gRPC)

**Node.js example:**
```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'http://tempo.observability.svc:4318/v1/traces',
  }),
  serviceName: 'my-app',
});
sdk.start();
```

**Environment variables:**
```yaml
env:
- name: OTEL_EXPORTER_OTLP_ENDPOINT
  value: "http://tempo.observability.svc:4318"
- name: OTEL_SERVICE_NAME
  value: "my-app"
- name: OTEL_RESOURCE_ATTRIBUTES
  value: "service.namespace=my-app-staging,deployment.environment=staging"
```

#### Metrics (Prometheus)

**Standard metrics to expose:**
- `http_requests_total{method, path, status_code}`
- `http_request_duration_seconds{method, path}` (histogram)
- `process_cpu_seconds_total`
- `process_resident_memory_bytes`
- Custom business metrics

**Node.js example (prom-client):**
```typescript
import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

const registry = new Registry();
collectDefaultMetrics({ register: registry });

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status_code'],
  registers: [registry],
});

// Expose on /metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});
```

### 14. Priority Classes

Priority classes determine pod scheduling priority during resource contention.

| Class | Value | Use Case |
|-------|-------|----------|
| `critical-infrastructure` | 1000000 | Pathfinder nodes, databases |
| `production` | 100000 | Production application pods |
| `tools` | 5000 | Development tools, one-off jobs |
| `staging` | 1000 | Staging/preview environments |

**Usage:**
```yaml
spec:
  priorityClassName: staging  # or production, etc.
```

### 15. Complete Deployment Example

**Full deployment manifest for a new application:**

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: my-app-staging
  labels:
    app: my-app
    component: api
    environment: staging
spec:
  replicas: 1
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
        component: api
        environment: staging
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
        prometheus.io/path: "/metrics"
    spec:
      priorityClassName: staging
      terminationGracePeriodSeconds: 30
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      imagePullSecrets:
      - name: ghcr-secret
      containers:
      - name: my-app
        image: ghcr.io/YOUR_ORG/my-app:staging
        imagePullPolicy: Always
        ports:
        - name: http
          containerPort: 3000
        envFrom:
        - configMapRef:
            name: my-app-config
        - secretRef:
            name: my-app-secrets
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          failureThreshold: 3
---
apiVersion: v1
kind: Service
metadata:
  name: my-app
  namespace: my-app-staging
  labels:
    app: my-app
    component: api
spec:
  type: ClusterIP
  selector:
    app: my-app
  ports:
  - name: http
    port: 3000
    targetPort: 3000
```

### 16. Migration Checklist

Use this checklist when migrating a Docker Compose application:

#### Pre-Migration
- [ ] Analyze docker-compose.yml for all services
- [ ] Identify environment variables and secrets
- [ ] Document volume mounts and storage needs
- [ ] Check network dependencies between services
- [ ] Review health checks and startup order

#### Namespace Setup
- [ ] Create namespace
- [ ] Create ResourceQuota
- [ ] Create LimitRange
- [ ] Create ghcr-secret for image pulls

#### Secrets Migration
- [ ] Extract all secrets from .env files
- [ ] Create Sealed Secrets for each
- [ ] Verify secrets decrypt correctly

#### Deployment
- [ ] Convert docker-compose services to Deployments
- [ ] Create Services for each deployment
- [ ] Create ConfigMaps for configuration
- [ ] Create PVCs for persistent storage
- [ ] Create Ingress for external access
- [ ] Create NetworkPolicies for isolation

#### Observability
- [ ] Add Prometheus annotations to pods
- [ ] Create ServiceMonitor for metrics scraping
- [ ] Create PrometheusRule for alerts
- [ ] Configure structured logging (JSON)
- [ ] Add OpenTelemetry tracing (optional)

#### CI/CD
- [ ] Add Dockerfile if not present
- [ ] Create GitHub Actions workflow
- [ ] Create ArgoCD Application
- [ ] Set up kustomization.yaml

#### Validation
- [ ] All pods running and healthy
- [ ] Ingress accessible externally
- [ ] Metrics visible in Prometheus
- [ ] Logs visible in Grafana/Loki
- [ ] Alerts firing correctly (test)

---

