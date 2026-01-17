# Vauban Blog - Web3 Decentralized Publishing Platform

**State-of-the-Art 2026** | Starknet L3 Madara Appchain + Arweave + IPFS + Next.js 15

Vauban Blog is a fully decentralized blogging platform leveraging:
- **Madara L3 Appchain** for sovereign blockchain infrastructure with auto-settlement to Starknet Sepolia
- **Arweave** for permanent, immutable content storage
- **IPFS** as a fast cache layer for optimal read performance
- **Session Keys + Paymaster** for gasless, frictionless UX (zero wallet popups after initial auth)
- **Next.js 15** (App Router + React 19) for modern, performant frontend

---

## Architecture Overview

```
User Browser (localhost:3000)
    ↓
Next.js 15 Frontend
    ↓
Madara L3 RPC (localhost:9944)
    ↓ Settlement every 100 blocks
Starknet Sepolia L2
    ↓
Storage Layer:
├─ Arweave (permanent, ~30s write)
└─ IPFS (cache, <200ms read)
```

**Key Features:**
- ✅ Admin publishes articles (MDX) → Dual upload Arweave + IPFS → On-chain registry
- ✅ Users read articles with content integrity verification (SHA256)
- ✅ Comments with Session Keys (zero popup after 1st auth)
- ✅ Paymaster sponsors gas fees for users
- ✅ Auto-settlement to Starknet Sepolia for L2 security

---

## Prerequisites

### Required Tools
- **Node.js** ≥ 20.0.0
- **pnpm** ≥ 8.0.0
- **Docker** + Docker Compose
- **Scarb** (Cairo toolchain) - [Install Guide](https://docs.swmansion.com/scarb)
- **starkli** (Starknet CLI) - [Install Guide](https://book.starkli.rs/installation)

### Install Scarb (Cairo)
```bash
curl -L https://install.swmansion.com | bash
export PATH="$HOME/.local/bin:$PATH"
scarb --version  # Verify installation
```

### Install starkli
```bash
curl https://get.starkli.sh | sh
starkliup
starkli --version
```

---

## Quick Start (Local Development)

### 1. Install Dependencies
```bash
# Install root dependencies + workspaces
pnpm install
```

### 2. Setup Environment Variables
```bash
# Copy example env file
cp .env.example .env.local

# Edit .env.local with your config:
# - Sepolia RPC URL (Infura/Alchemy)
# - Sepolia admin private key (for settlement)
# - Arweave wallet path
```

### 3. Create Arweave Wallet
```bash
# Generate Arweave wallet (needed for permanent storage)
npm install -g arweave
arweave key-create arweave-wallet.json

# Fund wallet (testnet or mainnet ~$5):
# https://faucet.arweave.net (if testnet available)
```

### 4. Fund Sepolia Wallet
```bash
# Admin wallet needs ETH on Sepolia for settlement gas
# Faucet: https://sepoliafaucet.com
# Minimum: 0.5 ETH (covers 500+ settlements)
```

### 5. Start Docker Services (Madara + Redis + IPFS)
```bash
pnpm docker:up

# Wait for services to be healthy (~30s)
docker ps  # Verify all containers running

# Check Madara RPC
curl http://localhost:9944/health
# Should return: {"status": "healthy"}
```

### 6. Build & Deploy Cairo Contracts
```bash
# Build contracts
pnpm contracts:build

# Run tests
pnpm contracts:test

# Deploy to Madara devnet
pnpm contracts:deploy

# Contract addresses will be saved to apps/frontend/.env.local
```

### 7. Start Frontend
```bash
cd apps/frontend
pnpm dev

# Open browser: http://localhost:3000
```

---

## Project Structure

```
vauban-blog/
├── apps/
│   ├── frontend/              # Next.js 15 App Router
│   │   ├── app/               # Pages (/, /articles/[slug], /admin/editor)
│   │   ├── components/        # React components (UI, Blog, Web3)
│   │   ├── hooks/             # Custom hooks (useWallet, usePosts, etc.)
│   │   ├── lib/               # Utils (starknet, ipfs, arweave)
│   │   └── providers/         # Context providers (Wallet, Theme)
│   │
│   └── devnet/                # Madara config files
│
├── contracts/                 # Cairo smart contracts
│   ├── src/
│   │   ├── blog_registry.cairo      # Article storage + metadata
│   │   ├── social.cairo             # Comments + likes
│   │   ├── paymaster.cairo          # Gas sponsorship
│   │   └── session_key_manager.cairo # Account Abstraction
│   ├── tests/                 # snforge tests
│   └── scripts/deploy.sh      # Deployment script
│
├── packages/
│   ├── shared-types/          # Zod schemas + TypeScript types
│   └── web3-utils/            # Starknet + IPFS + Arweave helpers
│
├── docker/
│   ├── docker-compose.yml     # Services orchestration
│   ├── madara/                # Madara L3 config
│   ├── ipfs/                  # IPFS node config
│   └── redis/                 # Redis config
│
├── scripts/                   # Automation scripts
├── docs/                      # Documentation
└── tests/                     # E2E integration tests
```

---

## Available Scripts

### Root Scripts
```bash
pnpm dev              # Start all workspaces in dev mode
pnpm build            # Build all workspaces
pnpm test             # Run all tests
pnpm lint             # Lint all workspaces
pnpm clean            # Clean all build artifacts
pnpm format           # Format code with Prettier
```

### Contracts Scripts
```bash
pnpm contracts:build   # Compile Cairo contracts
pnpm contracts:test    # Run snforge tests
pnpm contracts:deploy  # Deploy to Madara devnet
```

### Docker Scripts
```bash
pnpm docker:up         # Start all services (Madara + Redis + IPFS)
pnpm docker:down       # Stop all services
pnpm docker:logs       # Follow container logs
```

---

## Development Workflow

### 1. Publishing an Article

**Admin Flow:**
1. Navigate to `/admin/editor`
2. Connect wallet (ArgentX/Braavos)
3. Write article in MDX format
4. Fill metadata (title, tags, price, etc.)
5. Click "Publish"
   - ⏳ Upload to Arweave (permanent, ~30s)
   - ⚡ Pin to IPFS (cache, ~2s)
   - 🔐 Compute SHA256 hash
   - 📝 Sign transaction → `publish_post(arweave_tx_id, ipfs_cid, hash)`
   - ⛓️ Madara mines block (~6s)
   - ✅ Article live!

### 2. Reading an Article

**User Flow:**
1. Browse homepage → See article list
2. Click article
3. Frontend:
   - Fetches metadata from Madara RPC
   - Tries IPFS first (fast cache, <200ms)
   - Falls back to Arweave if IPFS miss
   - Verifies: `SHA256(content) === onchain_hash`
   - Renders article (Markdown → React)

### 3. Commenting (Gasless with Session Keys)

**User Flow:**
1. Scroll to comment section
2. First comment:
   - Wallet popup: "Authorize session key for 7 days"
   - User signs delegation
   - Session key stored locally
3. Subsequent comments:
   - **Zero popups!** Signed by session key
   - Paymaster covers gas fees
   - Comment posted instantly (optimistic UI)

---

## Architecture Decisions

### Why Arweave + IPFS?
- **Arweave**: Permanent, immutable storage (one-time cost ~$5/GB). Content survives forever.
- **IPFS**: Fast cache layer (<200ms reads). Local node or Pinata API.
- **Hybrid Strategy**: Best of both worlds (permanence + speed)

### Why Madara L3?
- **Sovereignty**: Full control over chain parameters, block time, fees
- **Performance**: >1000 TPS, 6s block time
- **Settlement**: Auto-settlement to Starknet Sepolia every 100 blocks for L2 security

### Why Session Keys?
- **UX**: Zero wallet popups after initial authorization
- **Gas**: Paymaster sponsors all transaction fees
- **Security**: Session keys expire after 7 days, scoped permissions

### Why Zod (not ArkType)?
- **Ecosystem**: Massive adoption, tRPC/Next.js native integration
- **Stability**: 5+ years, 30k+ GitHub stars
- **Performance**: 5ms validation overhead negligible vs 30s Arweave upload

---

## Troubleshooting

### Madara Won't Start
```bash
# Check logs
docker logs vauban-madara

# Common issues:
# 1. Port 9944 already in use → Stop other RPC nodes
# 2. Sepolia RPC unreachable → Check SEPOLIA_RPC_URL in .env
# 3. Private key invalid → Verify SEPOLIA_ADMIN_PRIVATE_KEY
```

### IPFS Node Not Accessible
```bash
# Check IPFS daemon
docker logs vauban-ipfs

# Restart IPFS
docker-compose restart ipfs

# Test gateway
curl http://localhost:8080/ipfs/QmTest...
```

### Contracts Deployment Fails
```bash
# Check Madara is running
curl http://localhost:9944/health

# Verify admin wallet has funds on devnet
starkli balance YOUR_ADMIN_ADDRESS --rpc http://localhost:9944

# Re-deploy with verbose logs
cd contracts/scripts
bash deploy.sh --verbose
```

---

## Production Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for:
- K3s cluster setup (Phase 2)
- ArgoCD GitOps configuration
- Prometheus + Grafana observability
- Disaster recovery procedures

---

## Contributing

This is a personal project for technical validation. Contributions welcome via:
1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

---

## Security

**Report vulnerabilities to:** [your-email@domain.com]

Security considerations:
- ✅ Content integrity verified via SHA256 hashes
- ✅ All user interactions signed (EIP-712 or Session Keys)
- ✅ Secrets stored in Sealed Secrets (not plaintext)
- ✅ Network policies enforce zero-trust
- ✅ Regular security audits planned for Phase 2

---

## License

MIT License - See [LICENSE](LICENSE) file for details

---

## Roadmap

### ✅ Phase 1 (MVP - Current)
- Madara L3 devnet with auto-settlement
- Arweave + IPFS dual storage
- Next.js 15 frontend with wallet connection
- Cairo contracts (BlogRegistry, Social, Paymaster, Session Keys)
- Admin editor + publish workflow
- Comments with gasless UX

### 🚧 Phase 2 (Q2 2026)
- Lit Protocol integration (token-gated premium articles)
- Payment processing (STRK transfers for paid content)
- Advanced search (Pagefind)
- K3s production deployment

### 📋 Phase 3 (Q3 2026)
- WebLLM local AI assistant
- Command Palette (Cmd+K)
- Mobile PWA
- Multi-author support

### 🔮 Phase 4 (Q4 2026)
- Multi-region Kubernetes (geo-redundancy)
- Advanced analytics dashboard
- Revenue sharing for guest authors
- DAO governance for platform evolution

---

## Acknowledgments

- **Starknet** team for Cairo 2.x and Account Abstraction
- **Madara** team for L3 Appchain framework
- **Arweave** for permanent storage infrastructure
- **IPFS** community for decentralized file system
- **Vercel** for Next.js 15 framework

---

**Built with ❤️ by a Senior Starknet Developer in France 🇫🇷**

For questions: [Discord](https://discord.gg/vauban) | [Twitter](https://twitter.com/vaubanblog)
