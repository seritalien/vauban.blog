# Vauban Blog

> **Own your words. Forever.**

A decentralized publishing platform where content is permanently stored on Arweave, cached on IPFS, and verified on Starknet L3.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Highlights

- **Permanent Storage** - Articles stored on Arweave survive forever
- **Fast Reads** - IPFS caching delivers content in <200ms
- **Verified Content** - SHA256 hashes on-chain detect tampering
- **Gasless UX** - Session keys + paymaster = zero fees for users
- **Fair Economics** - Authors keep 85% of revenue
- **Role-Based Access** - 7-tier permission system (Reader → Owner)

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Start infrastructure (Madara L3, IPFS, Redis)
pnpm docker:up

# Deploy smart contracts
pnpm contracts:build
pnpm contracts:deploy

# Start frontend
cd apps/frontend && pnpm dev
# Open http://localhost:3000
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](./docs/architecture.md) | System design, data flows, storage strategy |
| [Roles & Permissions](./docs/roles-and-permissions.md) | 7-tier role system, persona guides |
| [User Guide](./docs/user-guide.md) | End-user documentation by role |
| [API Reference](./docs/api-reference.md) | M2M API, contract interfaces |
| [Smart Contracts](./docs/smart-contracts.md) | Cairo contract documentation |
| [Developer Guide](./docs/developer-guide.md) | Local setup, contribution guide |
| [Deployment](./docs/deployment.md) | Production deployment guide |

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 15, React 19, Tailwind CSS 4, TypeScript |
| **Blockchain** | Madara L3 (Starknet-compatible), Cairo 2.x |
| **Storage** | Arweave (permanent), IPFS (cache) |
| **Wallet** | starknet.js v6, starknetkit v2 |
| **Validation** | Zod schemas |

---

## Project Structure

```
vauban.blog/
├── apps/frontend/         # Next.js application
├── contracts/             # Cairo smart contracts
├── packages/
│   ├── shared-types/      # Zod schemas, TypeScript types
│   └── web3-utils/        # Starknet, IPFS, Arweave utilities
├── docker/                # Docker Compose (Madara, IPFS, Redis)
├── scripts/               # CLI tools, automation
└── docs/                  # Documentation
```

---

## Smart Contracts

| Contract | Purpose |
|----------|---------|
| **RoleRegistry** | 7-tier role management |
| **BlogRegistry** | Article publishing, content workflow |
| **Social** | Comments, likes, reports, moderation |
| **Treasury** | Revenue distribution, withdrawals |
| **Reputation** | Points, levels, badges |
| **Paymaster** | Gas sponsorship |
| **SessionKeyManager** | Gasless UX via account abstraction |

---

## Role System

```
OWNER (6)      │ Platform governance, treasury, upgrades
ADMIN (5)      │ User management, settings, analytics
EDITOR (4)     │ Content approval, featuring, tags
MODERATOR (3)  │ Reports, bans, comment moderation
CONTRIBUTOR (2)│ Direct publish (trusted authors)
WRITER (1)     │ Submit for review, edit own drafts
READER (0)     │ View, like, comment
```

See [Roles & Permissions](./docs/roles-and-permissions.md) for details.

---

## Content Workflow

```
DRAFT → PENDING_REVIEW → PUBLISHED → ARCHIVED
                ↓
            REJECTED
```

- **Writers** submit drafts for review
- **Editors** approve, reject, or request revisions
- **Contributors** publish directly (trusted)

---

## Revenue Distribution

```
Article Sale ($10)
├── Author: $8.50 (85%)
├── Platform: $1.00 (10%)
└── Referrer: $0.50 (5%)
```

---

## Commands

```bash
# Development
pnpm dev              # Start all workspaces
pnpm build            # Build all workspaces
pnpm lint             # Lint all workspaces
pnpm test             # Run all tests

# Contracts
pnpm contracts:build  # Compile Cairo
pnpm contracts:test   # Run snforge tests
pnpm contracts:deploy # Deploy to Madara

# Infrastructure
pnpm docker:up        # Start services
pnpm docker:down      # Stop services
pnpm docker:logs      # View logs
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| pnpm | 8+ | `npm install -g pnpm` |
| Docker | 24+ | [docker.com](https://docker.com) |
| Scarb | 2.8+ | `curl -L https://install.swmansion.com \| bash` |
| starkli | 0.3+ | `curl https://get.starkli.sh \| sh && starkliup` |

---

## License

MIT License - See [LICENSE](LICENSE) for details.

---

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes following [Conventional Commits](https://conventionalcommits.org)
4. Push and open a Pull Request

See [Developer Guide](./docs/developer-guide.md) for setup instructions.

---

## Support

- **Issues**: [GitHub Issues](https://github.com/your-org/vauban.blog/issues)
- **Discord**: Community server (TBD)
- **Twitter**: [@VaubanBlog](https://twitter.com/VaubanBlog)

---

**Built with care in France**
