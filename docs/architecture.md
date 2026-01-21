# Architecture

This document describes the technical architecture of Vauban Blog, including data flows, storage strategy, and system design decisions.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Browser   │  │  Mobile App │  │   CLI Tool  │  │  M2M Client │        │
│  │  (Next.js)  │  │   (Future)  │  │ publish-cli │  │   API Key   │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
└─────────┼────────────────┼────────────────┼────────────────┼────────────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     Next.js API Routes                               │    │
│  │  /api/ipfs/*      - IPFS gateway proxy                              │    │
│  │  /api/m2m/publish - Machine-to-machine publishing                   │    │
│  │  /api/m2m/status  - Check publication status                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BLOCKCHAIN LAYER                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      Madara L3 Appchain                              │    │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │    │
│  │  │ BlogRegistry  │  │    Social     │  │ RoleRegistry  │           │    │
│  │  │ - Posts       │  │ - Comments    │  │ - Roles       │           │    │
│  │  │ - Metadata    │  │ - Likes       │  │ - Permissions │           │    │
│  │  │ - Workflow    │  │ - Reports     │  │ - Auto-promo  │           │    │
│  │  └───────────────┘  └───────────────┘  └───────────────┘           │    │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │    │
│  │  │   Treasury    │  │  Reputation   │  │   Paymaster   │           │    │
│  │  │ - Revenue     │  │ - Points      │  │ - Gas sponsor │           │    │
│  │  │ - Withdrawals │  │ - Badges      │  │ - Whitelist   │           │    │
│  │  │ - Splits      │  │ - Levels      │  │               │           │    │
│  │  └───────────────┘  └───────────────┘  └───────────────┘           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼ Settlement (every 100 blocks)          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     Starknet Sepolia (L2)                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STORAGE LAYER                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │      Arweave        │  │        IPFS         │  │       Redis         │  │
│  │  - Permanent store  │  │  - Fast cache       │  │  - Session cache    │  │
│  │  - ~$5/GB one-time  │  │  - <200ms reads     │  │  - Rate limiting    │  │
│  │  - 200+ year design │  │  - Local + Pinata   │  │  - Temp data        │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flows

### Publishing an Article

```
Author                  Frontend                 Blockchain              Storage
  │                        │                         │                      │
  │  1. Write article      │                         │                      │
  │───────────────────────►│                         │                      │
  │                        │                         │                      │
  │                        │  2. Compute SHA256      │                      │
  │                        │─────────┐               │                      │
  │                        │◄────────┘               │                      │
  │                        │                         │                      │
  │                        │  3. Upload to Arweave   │                      │
  │                        │────────────────────────────────────────────────►│
  │                        │◄───────────────────────────────────────────────│
  │                        │     (arweave_tx_id, ~30s)                      │
  │                        │                         │                      │
  │                        │  4. Pin to IPFS         │                      │
  │                        │────────────────────────────────────────────────►│
  │                        │◄───────────────────────────────────────────────│
  │                        │     (ipfs_cid, ~2s)     │                      │
  │                        │                         │                      │
  │                        │  5. publish_post()      │                      │
  │                        │────────────────────────►│                      │
  │                        │                         │  Store metadata      │
  │                        │                         │  (hash, cid, txid)   │
  │                        │◄────────────────────────│                      │
  │                        │     (post_id, ~6s)      │                      │
  │                        │                         │                      │
  │  6. Success!           │                         │                      │
  │◄───────────────────────│                         │                      │
```

### Reading an Article

```
Reader                  Frontend                 Blockchain              Storage
  │                        │                         │                      │
  │  1. Request article    │                         │                      │
  │───────────────────────►│                         │                      │
  │                        │                         │                      │
  │                        │  2. get_post(id)        │                      │
  │                        │────────────────────────►│                      │
  │                        │◄────────────────────────│                      │
  │                        │     (metadata)          │                      │
  │                        │                         │                      │
  │                        │  3. Try IPFS first      │                      │
  │                        │────────────────────────────────────────────────►│
  │                        │◄───────────────────────────────────────────────│
  │                        │     (content, <200ms)   │                      │
  │                        │                         │                      │
  │                        │  4. If IPFS miss, try Arweave                  │
  │                        │────────────────────────────────────────────────►│
  │                        │◄───────────────────────────────────────────────│
  │                        │     (content, ~2s)      │                      │
  │                        │                         │                      │
  │                        │  5. Verify SHA256       │                      │
  │                        │─────────┐               │                      │
  │                        │◄────────┘               │                      │
  │                        │  hash(content) === metadata.content_hash       │
  │                        │                         │                      │
  │  6. Render article     │                         │                      │
  │◄───────────────────────│                         │                      │
```

### Gasless Commenting (Session Keys)

```
User                    Frontend                 Blockchain
  │                        │                         │
  │  1. Click "Comment"    │                         │
  │───────────────────────►│                         │
  │                        │                         │
  │                        │  2. Check session key   │
  │                        │─────────┐               │
  │                        │◄────────┘               │
  │                        │                         │
  │  [First time only]     │                         │
  │  3. Sign delegation    │                         │
  │◄───────────────────────│                         │
  │───────────────────────►│                         │
  │                        │                         │
  │                        │  4. Register session key│
  │                        │────────────────────────►│
  │                        │◄────────────────────────│
  │                        │                         │
  │                        │  5. add_comment()       │
  │                        │  (signed by session key)│
  │                        │────────────────────────►│
  │                        │                         │
  │                        │                         │  6. Paymaster sponsors gas
  │                        │                         │     (user pays nothing)
  │                        │◄────────────────────────│
  │                        │                         │
  │  7. Comment posted!    │                         │
  │◄───────────────────────│                         │
```

---

## Storage Strategy

### Dual Storage: Arweave + IPFS

| Aspect | Arweave | IPFS |
|--------|---------|------|
| **Purpose** | Permanent archive | Fast cache |
| **Latency** | ~2-5s reads, ~30s writes | <200ms reads, ~2s writes |
| **Cost** | ~$5/GB one-time | Free (self-hosted) or Pinata fees |
| **Durability** | 200+ years (endowment model) | Requires pinning |
| **Use Case** | Source of truth | Performance layer |

### Content Verification

Every piece of content has a SHA256 hash stored on-chain:

```typescript
// On publish
const hash = SHA256(content);
await blogRegistry.publish_post(arweave_tx_id, ipfs_cid, hash, ...);

// On read
const content = await fetchFromIPFS(cid) || await fetchFromArweave(txid);
const verified = SHA256(content) === onchain_hash;
if (!verified) throw new Error("Content tampering detected!");
```

### Why This Approach?

1. **IPFS provides speed** - Local node or gateway serves content in <200ms
2. **Arweave provides permanence** - Content survives even if IPFS pins are lost
3. **On-chain hash provides verification** - Detect tampering regardless of source
4. **Fallback strategy** - If IPFS fails, Arweave is always available

---

## Smart Contract Architecture

### Contract Dependencies

```
                    ┌───────────────┐
                    │ RoleRegistry  │
                    │ (Central Auth)│
                    └───────┬───────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ BlogRegistry  │   │    Social     │   │  Reputation   │
│   (Posts)     │   │  (Comments)   │   │   (Points)    │
└───────┬───────┘   └───────┬───────┘   └───────────────┘
        │                   │
        └─────────┬─────────┘
                  │
                  ▼
          ┌───────────────┐
          │   Treasury    │
          │  (Payments)   │
          └───────────────┘
                  │
                  ▼
          ┌───────────────┐
          │   Paymaster   │
          │ (Gas Sponsor) │
          └───────────────┘
```

### Role-Based Access Control

All contracts query `RoleRegistry` for authorization:

```cairo
// In BlogRegistry
fn approve_post(ref self: ContractState, post_id: u256) {
    let caller = get_caller_address();
    let role = IRoleRegistryDispatcher { contract_address: self.role_registry.read() }
        .get_role(caller);

    // Only EDITOR (4) or higher can approve
    assert(role >= ROLE_EDITOR, 'Insufficient permissions');

    // ... approve logic
}
```

### Contract Addresses

After deployment, addresses are stored in `.deployments.json`:

```json
{
  "network": "madara-devnet",
  "deployed_at": "2024-01-15T10:30:00Z",
  "contracts": {
    "RoleRegistry": "0x123...",
    "BlogRegistry": "0x456...",
    "Social": "0x789...",
    "Treasury": "0xabc...",
    "Reputation": "0xdef...",
    "Paymaster": "0x111...",
    "SessionKeyManager": "0x222..."
  }
}
```

---

## Frontend Architecture

### Directory Structure

```
apps/frontend/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Homepage (article list)
│   ├── layout.tsx          # Root layout with providers
│   ├── articles/
│   │   └── [slug]/
│   │       └── page.tsx    # Article detail
│   ├── authors/
│   │   ├── page.tsx        # Authors list
│   │   └── [address]/
│   │       └── page.tsx    # Author profile
│   ├── dashboard/
│   │   └── page.tsx        # Author dashboard
│   ├── admin/
│   │   ├── page.tsx        # Admin home
│   │   ├── posts/          # Post management
│   │   ├── review/         # Editor review queue
│   │   ├── moderation/     # Moderator queue
│   │   └── analytics/      # Platform analytics
│   └── api/
│       ├── ipfs/           # IPFS proxy
│       └── m2m/            # Machine-to-machine API
├── components/
│   ├── layout/             # Header, Footer, Navigation
│   ├── article/            # ArticleCard, ArticleContent
│   ├── comments/           # CommentSection, CommentForm
│   ├── editor/             # MarkdownEditor, TagInput
│   ├── home/               # HeroSection, FeaturedArticles
│   ├── social/             # ShareButtons, LikeButton
│   ├── newsletter/         # NewsletterSignup
│   └── ui/                 # TrustBadges, AuthorBadge, etc.
├── hooks/
│   ├── use-role.ts         # Role fetching
│   ├── use-permissions.ts  # Permission checking
│   ├── use-posts.ts        # Post CRUD operations
│   └── use-wallet.ts       # Wallet connection
├── lib/
│   ├── starknet.ts         # Contract interactions
│   ├── ipfs.ts             # IPFS utilities
│   ├── arweave.ts          # Arweave utilities
│   ├── relayer.ts          # Server-side signing
│   └── api-keys.ts         # M2M API key validation
└── providers/
    ├── wallet-provider.tsx # Starknet wallet context
    └── theme-provider.tsx  # Dark/light mode
```

### State Management

| State Type | Solution |
|------------|----------|
| Server state (posts, comments) | React Query + Server Components |
| Wallet state | starknetkit v2 hooks |
| UI state (modals, toasts) | React useState/useContext |
| Form state | React Hook Form |
| Theme | next-themes |

### Permission-Aware UI

Components use permission hooks to conditionally render:

```tsx
import { RequirePermission } from '@/hooks/use-permissions';

function AdminPanel() {
  return (
    <div>
      {/* Only visible to Editors+ */}
      <RequirePermission permission="canApproveContent">
        <ReviewQueueLink />
      </RequirePermission>

      {/* Only visible to Admins+ */}
      <RequirePermission permission="canAccessAnalytics">
        <AnalyticsLink />
      </RequirePermission>
    </div>
  );
}
```

---

## Infrastructure

### Docker Services

```yaml
# docker/docker-compose.yml
services:
  madara:
    # Starknet L3 appchain
    ports: ["9944:9944"]  # JSON-RPC

  ipfs:
    # IPFS node for content caching
    ports:
      - "5001:5001"  # API
      - "8080:8080"  # Gateway

  redis:
    # Session cache, rate limiting
    ports: ["6379:6379"]
```

### Network Configuration

| Service | Port | Purpose |
|---------|------|---------|
| Madara RPC | 9944 | Blockchain JSON-RPC |
| IPFS API | 5001 | Upload/pin content |
| IPFS Gateway | 8080 | Read content |
| Redis | 6379 | Cache, rate limiting |
| Frontend | 3000 | Next.js application |

### Settlement to L2

Madara L3 auto-settles to Starknet Sepolia every 100 blocks:

```
L3 Block 100  ──────► Sepolia State Update
L3 Block 200  ──────► Sepolia State Update
L3 Block 300  ──────► Sepolia State Update
...
```

This provides:
- **Finality** - L3 transactions inherit L2 security
- **Bridging** - Assets can be bridged via state updates
- **Auditability** - L3 state is verifiable on L2

---

## Security Model

### Defense in Depth

| Layer | Protection |
|-------|------------|
| Frontend | Input validation (Zod), XSS prevention |
| API | Rate limiting, API key auth, CORS |
| Contracts | Access control, reentrancy guards, pausable |
| Storage | SHA256 verification, dual storage redundancy |

### Access Control Matrix

| Action | Reader | Writer | Contributor | Moderator | Editor | Admin | Owner |
|--------|--------|--------|-------------|-----------|--------|-------|-------|
| View public content | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Like/comment | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Submit for review | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Direct publish | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Resolve reports | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Approve posts | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Manage users | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Withdraw treasury | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

### Session Key Constraints

Session keys are limited in scope:
- **Duration**: 7-day expiry (configurable)
- **Permissions**: Only `Social` contract calls (comment, like)
- **No financial actions**: Cannot transfer tokens or withdraw
- **Revocable**: Users can revoke at any time

---

## Performance Considerations

### Optimizations

| Optimization | Benefit |
|--------------|---------|
| IPFS caching | <200ms content reads |
| Server Components | Reduced client JS bundle |
| Static generation | Pre-rendered pages where possible |
| Contract batching | Multiple reads in single call |
| Redis caching | Fast session/rate limit checks |

### Bottlenecks & Mitigations

| Bottleneck | Mitigation |
|------------|------------|
| Arweave write latency (~30s) | Show optimistic UI, confirm later |
| Contract call latency (~6s block) | Optimistic updates, background refresh |
| Large IPFS fetches | Chunked loading, lazy images |

---

## Monitoring & Observability

### Health Checks

```bash
# Madara L3
curl http://localhost:9944/health

# IPFS
curl http://localhost:5001/api/v0/id

# Redis
redis-cli ping

# Frontend
curl http://localhost:3000/api/health
```

### Logs

```bash
# All services
pnpm docker:logs

# Individual
docker logs -f vauban-madara-l3
docker logs -f vauban-ipfs
docker logs -f vauban-redis
```

### Metrics (Future)

- Block production rate
- Transaction throughput
- IPFS pin count
- Content verification success rate
- Error rates by endpoint
