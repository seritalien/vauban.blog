# Vauban Blog Documentation

> **Own your words. Forever.**

Vauban Blog is a fully decentralized publishing platform where content is permanently stored on Arweave, cached on IPFS, and verified on-chain via Starknet L3.

## Quick Navigation

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | Technical design, data flows, storage strategy |
| [Roles & Permissions](./roles-and-permissions.md) | 7-tier role system, persona guides |
| [User Guide](./user-guide.md) | End-user documentation by role |
| [API Reference](./api-reference.md) | M2M API, contract interfaces |
| [Smart Contracts](./smart-contracts.md) | Cairo contract documentation |
| [Developer Guide](./developer-guide.md) | Local setup, contribution guide |
| [Deployment](./deployment.md) | Production deployment guide |

---

## Platform Overview

### What Makes Vauban Different

| Feature | Traditional Blogs | Vauban Blog |
|---------|-------------------|-------------|
| **Content Storage** | Centralized servers | Arweave (permanent) + IPFS (fast) |
| **Ownership** | Platform owns data | Authors own content cryptographically |
| **Verification** | Trust the platform | SHA256 hash verified on-chain |
| **Censorship** | Can be deleted | Immutable on Arweave |
| **Monetization** | Platform takes 30-50% | Authors keep 85%+ |
| **Identity** | Email/password | Wallet-based (self-sovereign) |

### Core Value Propositions

1. **Permanence** - Content stored on Arweave survives forever (200+ year design)
2. **Verification** - Every article has an on-chain SHA256 hash for tamper detection
3. **Ownership** - Authors control their content via cryptographic keys
4. **Fair Economics** - 85% revenue to creators, 10% platform, 5% referrals
5. **Gasless UX** - Session keys + paymaster = zero transaction fees for users

---

## Technology Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER                               │
│  Next.js 15 (App Router) + React 19 + Tailwind CSS 4                │
│  starknet.js v6 + starknetkit v2 (wallet integration)               │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         BLOCKCHAIN LAYER                             │
│  Madara L3 Appchain (Starknet-compatible, 6s blocks, 1000+ TPS)     │
│  Cairo Smart Contracts: BlogRegistry, Social, RoleRegistry,         │
│  Treasury, Reputation, Paymaster, SessionKeyManager                  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         STORAGE LAYER                                │
│  Arweave (permanent, ~$5/GB one-time) + IPFS (fast cache, <200ms)  │
│  Redis (session cache, rate limiting)                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Role Hierarchy

Vauban implements a 7-tier permission system:

```
OWNER (6)      │ Platform governance, treasury, upgrades
    ▼          │
ADMIN (5)      │ User management, settings, analytics
    ▼          │
EDITOR (4)     │ Content approval, featuring, tags
    ▼          │
MODERATOR (3)  │ Reports, bans, comment moderation
    ▼          │
CONTRIBUTOR (2)│ Direct publish (trusted authors)
    ▼          │
WRITER (1)     │ Submit for review, edit own drafts
    ▼          │
READER (0)     │ View, like, comment
```

See [Roles & Permissions](./roles-and-permissions.md) for detailed capabilities.

---

## Content Workflow

```
┌──────────┐    ┌─────────────────┐    ┌───────────────┐    ┌───────────┐
│  DRAFT   │───►│ PENDING_REVIEW  │───►│  PUBLISHED    │───►│ ARCHIVED  │
│  (0)     │    │      (1)        │    │     (2)       │    │    (4)    │
└──────────┘    └────────┬────────┘    └───────────────┘    └───────────┘
                         │
                         ▼
                   ┌───────────┐
                   │ REJECTED  │
                   │    (3)    │
                   └───────────┘
```

- **Writers** submit drafts → pending review
- **Editors** approve/reject → published or rejected
- **Contributors** bypass review → direct publish
- **Anyone** can archive their own published posts

---

## Quick Start

### For Readers
1. Visit the homepage to browse articles
2. Connect wallet (optional) to like and comment
3. No wallet needed for reading public content

### For Writers
1. Connect wallet (ArgentX or Braavos)
2. Navigate to Dashboard → New Post
3. Write in Markdown, add tags and cover image
4. Submit for review (Editors will approve/reject)

### For Developers
```bash
# Clone and install
git clone https://github.com/your-org/vauban.blog
cd vauban.blog
pnpm install

# Start infrastructure
pnpm docker:up

# Deploy contracts
pnpm contracts:build
pnpm contracts:deploy

# Start frontend
cd apps/frontend && pnpm dev
```

See [Developer Guide](./developer-guide.md) for complete setup.

---

## Repository Structure

```
vauban.blog/
├── apps/
│   └── frontend/          # Next.js 15 application
│       ├── app/           # App Router pages
│       ├── components/    # React components
│       ├── hooks/         # Custom React hooks
│       ├── lib/           # Utilities
│       └── providers/     # Context providers
├── contracts/             # Cairo smart contracts
│   ├── src/               # Contract source files
│   ├── tests/             # snforge tests
│   └── scripts/           # Deployment scripts
├── packages/
│   ├── shared-types/      # Zod schemas, TypeScript types
│   └── web3-utils/        # Starknet, IPFS, Arweave helpers
├── docker/                # Docker Compose (Madara, IPFS, Redis)
├── scripts/               # CLI tools, automation
└── docs/                  # This documentation
```

---

## License

MIT License - See [LICENSE](../LICENSE) for details.

---

## Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/your-org/vauban.blog/issues)
- **Discord**: Join our community (link TBD)
- **Twitter/X**: Follow [@VaubanBlog](https://twitter.com/VaubanBlog)
