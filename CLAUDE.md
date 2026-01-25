# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vauban Blog is a fully decentralized blogging platform built on:
- **Madara L3 Appchain** (sovereign Starknet blockchain with auto-settlement to Sepolia)
- **Arweave** (permanent immutable content storage)
- **IPFS** (fast cache layer)
- **Next.js 15** (App Router + React 19)
- **Cairo Smart Contracts** (BlogRegistry, Social, Paymaster, SessionKeyManager)

The architecture implements a dual-storage strategy: Arweave for permanence (~30s writes) and IPFS for speed (<200ms reads), with on-chain SHA256 verification for content integrity.

## Technology Stack

### Frontend
- **Next.js 15** with App Router and React 19
- **TypeScript** with strict mode
- **Tailwind CSS 4.0** for styling
- **starknet.js v6** + **starknetkit v2** for wallet integration
- **Zod** for schema validation (NOT ArkType - this was a conscious architectural decision)

### Backend/Blockchain
- **Cairo 2.x** (Scarb edition 2024_07, Starknet 2.15.0)
- **Madara L3** (custom Starknet appchain)
- **Docker Compose** for orchestration (Madara + Redis + IPFS)

### Workspace Structure
- **pnpm workspaces** + **Turborepo** for monorepo management
- `apps/frontend` - Next.js application
- `packages/shared-types` - Zod schemas and TypeScript types
- `packages/web3-utils` - Starknet, IPFS, Arweave utilities
- `contracts/` - Cairo smart contracts

## Common Commands

### Prerequisites Setup
```bash
# Install Scarb (Cairo toolchain)
curl -L https://install.swmansion.com | bash
scarb --version

# Install starkli (Starknet CLI)
curl https://get.starkli.sh | sh
starkliup
starkli --version
```

### Development Workflow
```bash
# Install all dependencies
pnpm install

# Start Docker services (Madara L3 + Redis + IPFS)
pnpm docker:up

# Check services health
docker ps
curl http://localhost:9944/health  # Madara RPC
docker logs vauban-madara-l3       # View Madara logs
docker logs vauban-ipfs            # View IPFS logs

# Build and test contracts
pnpm contracts:build    # Compile Cairo contracts
pnpm contracts:test     # Run snforge tests
pnpm contracts:deploy   # Deploy to Madara devnet (saves addresses to .deployments.json)

# Start frontend
cd apps/frontend
pnpm dev                # http://localhost:3000

# Run all workspace scripts
pnpm dev                # Start all workspaces in dev mode
pnpm build              # Build all workspaces
pnpm test               # Run all tests
pnpm lint               # Lint all workspaces
pnpm format             # Format with Prettier
pnpm clean              # Clean build artifacts
```

### Docker Operations
```bash
pnpm docker:down        # Stop all services
pnpm docker:logs        # Follow container logs

# Individual service management
docker logs -f vauban-madara-l3
docker logs -f vauban-ipfs
docker logs -f vauban-redis

# Restart specific service
cd docker && docker-compose restart madara
```

### Contract Development
```bash
cd contracts/

# Build contracts
scarb build

# Run tests with snforge
snforge test                    # Run all tests
snforge test test_publish_post  # Run specific test
snforge test --exact            # Exact test name match

# Deploy with custom network
RPC_URL=http://localhost:9944 bash scripts/deploy.sh
# OR
bash scripts/deploy.sh --network http://localhost:9944 --account ~/.starknet_accounts/deployer.json

# Interact with deployed contracts
starkli call <CONTRACT_ADDRESS> get_post_count --rpc http://localhost:9944
starkli invoke <CONTRACT_ADDRESS> publish_post <args> --rpc http://localhost:9944 --account <account>
```

### Frontend Development
```bash
cd apps/frontend/

# Development
pnpm dev                # Start dev server (localhost:3000)
pnpm build              # Production build
pnpm start              # Start production server
pnpm type-check         # Run TypeScript checks
pnpm lint               # Run ESLint

# Environment setup
cp .env.local.example .env.local
# Edit .env.local with contract addresses (auto-populated after pnpm contracts:deploy)
```

### Shared Packages Development
```bash
# shared-types (Zod schemas)
cd packages/shared-types/
pnpm build              # Build with tsup (CJS + ESM + .d.ts)
pnpm dev                # Watch mode
pnpm type-check         # TypeScript validation

# web3-utils (IPFS, Arweave, Starknet)
cd packages/web3-utils/
pnpm build              # Build with tsup
pnpm dev                # Watch mode
pnpm type-check         # TypeScript validation
```

## Architecture Deep Dive

### Smart Contracts (Cairo)

**contracts/src/blog_registry.cairo** - Core article registry
- Stores post metadata (Arweave TX ID, IPFS CID, SHA256 hash)
- Access control (owner, admins)
- Rate limiting (publish cooldown)
- Treasury + platform fees
- Pausable + reentrancy guards
- Soft delete support

**contracts/src/social.cairo** - Comments and likes
- Comment storage per post
- Like/unlike functionality
- Session key support for gasless interactions
- Moderation (delete comments)

**contracts/src/paymaster.cairo** - Gas sponsorship
- Whitelisted contracts (only Social contract can use it)
- Admin-controlled funding and withdrawal
- Tracks total sponsored gas

**contracts/src/session_key_manager.cairo** - Account Abstraction
- Session key registration (time-limited, scoped permissions)
- Session key validation
- Session key revocation
- Nonce management for replay protection

### Frontend Architecture

**apps/frontend/app/** - Next.js 15 App Router
- `/page.tsx` - Homepage (article list)
- `/articles/[slug]/page.tsx` - Article detail page
- `/admin/editor/page.tsx` - Admin MDX editor

**apps/frontend/components/**
- `layout/` - Header, Footer, Navigation
- `comments/` - CommentSection, CommentForm, CommentList

**apps/frontend/hooks/**
- Custom React hooks for Starknet interactions
- Wallet connection state
- Post fetching and submission
- Comments management

**apps/frontend/lib/**
- `starknet.ts` - Contract call wrappers
- `ipfs.ts` - IPFS upload/fetch utilities
- `arweave.ts` - Arweave upload utilities

**apps/frontend/providers/**
- WalletProvider - Starknet wallet context (starknetkit)
- ThemeProvider - Dark/light mode
- Web3Provider - Combined Web3 context

### Shared Packages

**packages/shared-types/src/**
- `post.ts` - PostMetadata, CreatePostInput, UpdatePostInput (Zod schemas)
- `comment.ts` - Comment, CreateCommentInput (Zod schemas)
- `session-key.ts` - SessionKey schemas
- `index.ts` - Re-exports all schemas

**packages/web3-utils/src/**
- `starknet.ts` - Contract interaction helpers (publish, comment, like)
- `ipfs.ts` - IPFS client (upload, fetch, pin)
- `arweave.ts` - Arweave client (upload, fetch, verify)
- `abis/` - Contract ABIs (auto-generated from Cairo)
- `index.ts` - Re-exports all utilities

### Key Data Flow

**Publishing an Article (Admin)**
1. Admin writes MDX in `/admin/editor`
2. Frontend computes SHA256 hash of content
3. Upload to Arweave (~30s, returns TX ID)
4. Pin to IPFS (~2s, returns CID)
5. Call `BlogRegistry.publish_post(arweave_tx_id, ipfs_cid, content_hash, price, is_encrypted)`
6. Madara mines block (~6s)
7. Article appears on homepage

**Reading an Article (User)**
1. Frontend fetches post metadata from `BlogRegistry.get_post(id)`
2. Try IPFS first (fast cache): `GET http://localhost:8080/ipfs/{cid}`
3. Fallback to Arweave if IPFS miss: `GET https://arweave.net/{tx_id}`
4. Verify: `SHA256(fetched_content) === metadata.content_hash`
5. Render MDX with react-markdown

**Commenting (Gasless UX)**
1. User clicks "Add Comment"
2. **First time**: Wallet popup → Sign session key delegation (7-day expiry)
3. **Subsequent comments**: Zero popups, signed by local session key
4. Frontend calls `Social.add_comment(post_id, content, session_key_signature)`
5. Paymaster sponsors gas (user pays nothing)
6. Comment stored on-chain

## Development Guidelines

### When Modifying Cairo Contracts

1. **Always run tests before deployment**
   ```bash
   cd contracts && snforge test
   ```

2. **Contract deployment creates `.deployments.json` at project root**
   - Contains all deployed contract addresses
   - Auto-updates `apps/frontend/.env.local` with addresses

3. **Access control patterns**
   - All contracts use `owner` + `admins` mapping
   - Modifier pattern: `assert_only_owner()`, `assert_only_admin()`
   - Pausable: `assert_not_paused()`

4. **Security considerations**
   - All state-changing functions have reentrancy guards
   - Input validation (non-zero addresses, string lengths, etc.)
   - Rate limiting on publish actions (cooldown period)

5. **Testing patterns**
   - Use `snforge` for unit tests
   - Test both happy paths and error cases
   - Test access control (unauthorized calls should fail)

### When Modifying Frontend

1. **Wallet integration uses starknetkit v2**
   - ArgentX and Braavos support
   - Session keys for gasless transactions
   - Always handle wallet connection errors gracefully

2. **Content verification is mandatory**
   - Always verify `SHA256(fetched_content) === onchain_hash`
   - Show error if verification fails (content tampering detected)

3. **IPFS + Arweave hybrid strategy**
   - Try IPFS first (fast)
   - Fallback to Arweave (slow but permanent)
   - Show loading states for both attempts

4. **Environment variables**
   - `NEXT_PUBLIC_*` for client-side variables
   - Contract addresses auto-populated by deploy script
   - Never commit `.env.local` (use `.env.local.example`)

### When Modifying Shared Packages

1. **shared-types uses Zod for validation**
   - Export both Zod schema and TypeScript type
   - Example: `PostSchema` (Zod) → `Post` (TypeScript type via `z.infer`)

2. **web3-utils exports async functions**
   - All functions return `Promise<T>`
   - Handle errors with try/catch
   - Retry logic for IPFS/Arweave (3 attempts with exponential backoff)

3. **Building shared packages**
   - Run `pnpm build` in package directory
   - Turborepo automatically rebuilds dependents
   - Frontend hot-reloads when packages change (in dev mode)

## Troubleshooting Common Issues

### Madara Won't Start
```bash
# Check logs
docker logs vauban-madara-l3

# Common fixes:
# 1. Port 9944 already in use
sudo lsof -i :9944
kill -9 <PID>

# 2. Sepolia RPC unreachable (check .env)
# Verify SEPOLIA_RPC_URL is valid (Infura/Alchemy)

# 3. Reset Madara data
docker-compose down -v
docker-compose up -d
```

### Contract Deployment Fails
```bash
# Verify Madara is healthy
curl http://localhost:9944/health

# Check deployer wallet has funds on devnet
starkli balance <DEPLOYER_ADDRESS> --rpc http://localhost:9944

# Re-compile contracts
cd contracts && scarb clean && scarb build

# Deploy with verbose logs
cd contracts/scripts
bash deploy.sh --verbose
```

### IPFS Content Not Accessible
```bash
# Check IPFS daemon
docker logs vauban-ipfs
ipfs id  # Should return peer ID

# Restart IPFS
docker-compose restart ipfs

# Test gateway
curl http://localhost:8080/ipfs/QmTest...

# Pin content manually
ipfs pin add <CID>
```

### Frontend Can't Connect to Contracts
```bash
# 1. Check .env.local has correct addresses
cat apps/frontend/.env.local

# 2. Verify contracts deployed
cat .deployments.json

# 3. Check RPC connectivity
curl http://localhost:9944/health

# 4. Rebuild frontend
cd apps/frontend && rm -rf .next && pnpm build
```

## Important Architectural Decisions

### Why Zod (not ArkType)?
Zod was chosen for schema validation despite ArkType's performance claims because:
- Massive ecosystem adoption (tRPC, Next.js native integration)
- 5+ years of stability (30k+ GitHub stars)
- 5ms validation overhead is negligible compared to 30s Arweave uploads
- Team familiarity and extensive documentation

### Why Dual Storage (Arweave + IPFS)?
- **Arweave**: Permanent, immutable (one-time cost ~$5/GB). Content survives forever.
- **IPFS**: Fast cache (<200ms reads). Local node or Pinata API.
- **Best of both worlds**: Permanence + speed.

### Why Madara L3?
- **Sovereignty**: Full control over chain parameters, block time, fees
- **Performance**: >1000 TPS, 6s block time
- **Settlement**: Auto-settlement to Starknet Sepolia every 100 blocks for L2 security

### Why Session Keys + Paymaster?
- **UX**: Zero wallet popups after initial authorization
- **Gas**: Paymaster sponsors all transaction fees (free for users)
- **Security**: Session keys expire after 7 days, scoped permissions (only comment actions)

## Contract Deployment Outputs

After running `pnpm contracts:deploy`:
- **`.deployments.json`** created at project root (all contract addresses)
- **`apps/frontend/.env.local`** auto-updated with contract addresses
- Contracts deployed in order: BlogRegistry → Social → Paymaster → SessionKeyManager
- Post-deployment config: Social contract whitelisted in Paymaster

## Testing Strategy

### Cairo Contracts
- Unit tests with `snforge` in `contracts/tests/`
- Test all access control modifiers
- Test reentrancy protection
- Test rate limiting

### Frontend
- Type checking with `tsc --noEmit`
- Linting with ESLint
- Manual testing in browser (no automated UI tests yet)

### Integration
- E2E tests planned in `tests/` directory
- Manual workflow: publish article → read article → comment → verify on-chain

## Essential Files to Understand

When navigating the codebase, start with these files:
1. `README.md` - Setup and architecture overview
2. `contracts/src/blog_registry.cairo` - Core contract logic
3. `apps/frontend/app/page.tsx` - Homepage implementation
4. `packages/shared-types/src/post.ts` - Data schemas
5. `docker/docker-compose.yml` - Infrastructure services
6. `contracts/scripts/deploy.sh` - Deployment automation

## Kubernetes (k3s) Deployment Notes

### Scheduled Posts CronJob

The scheduled post publishing requires a Kubernetes CronJob to trigger the endpoint periodically.
This is NOT yet implemented - add to `k8s/k8s/frontend/` when deploying:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: publish-scheduled-posts
  namespace: vauban
spec:
  schedule: "* * * * *"  # Every minute
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: curl
            image: curlimages/curl:8.5.0
            command:
            - /bin/sh
            - -c
            - |
              curl -sf -H "Authorization: Bearer ${CRON_SECRET}" \
                "http://frontend-service.vauban.svc.cluster.local:3005/api/cron/publish-scheduled"
            env:
            - name: CRON_SECRET
              valueFrom:
                secretKeyRef:
                  name: vauban-secrets
                  key: cron-secret
          restartPolicy: OnFailure
```

### AI Providers

For production, prefer OpenRouter with free models:
- **google/gemini-2.5-flash-lite:free** - Fastest, good for tags/titles
- **google/gemini-2.5-flash:free** - Balanced, content generation
- **meta-llama/llama-3.3-70b-instruct:free** - Highest quality, heavy tasks
- **deepseek/deepseek-chat:free** - Good French support, alternative
