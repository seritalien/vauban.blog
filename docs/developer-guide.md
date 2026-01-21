# Developer Guide

This guide covers local development setup, contribution guidelines, and best practices.

---

## Prerequisites

### Required Software

| Software | Version | Installation |
|----------|---------|--------------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| pnpm | 8+ | `npm install -g pnpm` |
| Docker | 24+ | [docker.com](https://docker.com) |
| Scarb | 2.8+ | `curl -L https://install.swmansion.com \| bash` |
| starkli | 0.3+ | `curl https://get.starkli.sh \| sh && starkliup` |

### Verify Installation

```bash
node --version      # v20.x.x
pnpm --version      # 8.x.x
docker --version    # Docker version 24.x.x
scarb --version     # scarb 2.8.x
starkli --version   # starkli 0.3.x
```

---

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/your-org/vauban.blog
cd vauban.blog
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Start Infrastructure

```bash
# Start Madara L3, IPFS, Redis
pnpm docker:up

# Verify services
docker ps
curl http://localhost:9944/health  # Madara
curl http://localhost:5001/api/v0/id  # IPFS
```

### 4. Build & Deploy Contracts

```bash
# Build Cairo contracts
pnpm contracts:build

# Deploy to local Madara
pnpm contracts:deploy

# Verify deployment
cat .deployments.json
```

### 5. Start Frontend

```bash
cd apps/frontend
cp .env.local.example .env.local
# Contract addresses auto-populated by deploy script

pnpm dev
# Open http://localhost:3000
```

---

## Project Structure

```
vauban.blog/
├── apps/
│   └── frontend/              # Next.js 15 application
│       ├── app/               # App Router pages
│       │   ├── page.tsx       # Homepage
│       │   ├── layout.tsx     # Root layout
│       │   ├── articles/      # Article pages
│       │   ├── authors/       # Author pages
│       │   ├── dashboard/     # User dashboard
│       │   ├── admin/         # Admin pages
│       │   └── api/           # API routes
│       ├── components/        # React components
│       ├── hooks/             # Custom hooks
│       ├── lib/               # Utilities
│       └── providers/         # Context providers
├── contracts/                 # Cairo smart contracts
│   ├── src/                   # Contract source files
│   │   ├── blog_registry.cairo
│   │   ├── social.cairo
│   │   ├── role_registry.cairo
│   │   ├── treasury.cairo
│   │   ├── reputation.cairo
│   │   ├── paymaster.cairo
│   │   └── session_key_manager.cairo
│   ├── tests/                 # snforge tests
│   └── scripts/               # Deployment scripts
├── packages/
│   ├── shared-types/          # Zod schemas, TypeScript types
│   │   └── src/
│   │       ├── post.ts
│   │       ├── comment.ts
│   │       ├── role.ts
│   │       └── index.ts
│   └── web3-utils/            # Blockchain utilities
│       └── src/
│           ├── starknet.ts
│           ├── ipfs.ts
│           ├── arweave.ts
│           └── index.ts
├── docker/                    # Docker Compose
│   └── docker-compose.yml
├── scripts/                   # CLI tools
│   ├── publish-cli.ts
│   └── watch-publish.ts
├── docs/                      # Documentation
├── .deployments.json          # Deployed contract addresses
├── turbo.json                 # Turborepo config
├── pnpm-workspace.yaml        # pnpm workspace config
└── package.json               # Root package.json
```

---

## Development Workflows

### Frontend Development

```bash
cd apps/frontend

# Start dev server with hot reload
pnpm dev

# Type check
pnpm type-check

# Lint
pnpm lint

# Format
pnpm format

# Build for production
pnpm build

# Start production server
pnpm start
```

### Contract Development

```bash
cd contracts

# Build contracts
scarb build

# Run all tests
snforge test

# Run specific test
snforge test test_publish_post

# Run with verbosity
snforge test --verbose

# Format Cairo code
scarb fmt

# Check for issues
scarb check
```

### Shared Packages

```bash
# shared-types
cd packages/shared-types
pnpm build     # Build with tsup
pnpm dev       # Watch mode
pnpm type-check

# web3-utils
cd packages/web3-utils
pnpm build
pnpm dev
pnpm type-check
```

### Full Build

```bash
# From root directory
pnpm build     # Build all packages
pnpm test      # Run all tests
pnpm lint      # Lint all packages
pnpm type-check  # Type check all
```

---

## Configuration

### Environment Variables

**Frontend** (`apps/frontend/.env.local`):

```env
# Contract Addresses (auto-populated by deploy script)
NEXT_PUBLIC_ROLE_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_SOCIAL_ADDRESS=0x...
NEXT_PUBLIC_TREASURY_ADDRESS=0x...
NEXT_PUBLIC_REPUTATION_ADDRESS=0x...
NEXT_PUBLIC_PAYMASTER_ADDRESS=0x...
NEXT_PUBLIC_SESSION_KEY_MANAGER_ADDRESS=0x...

# Network
NEXT_PUBLIC_STARKNET_RPC=http://localhost:9944
NEXT_PUBLIC_CHAIN_ID=0x534e5f5345504f4c4941  # Madara devnet

# IPFS
NEXT_PUBLIC_IPFS_GATEWAY=http://localhost:8080
IPFS_API_URL=http://localhost:5001

# Arweave
ARWEAVE_KEY={"kty":"RSA",...}  # JWK key for uploads

# M2M API
M2M_API_KEY=your-secret-api-key

# Relayer (server-side signing)
RELAYER_PRIVATE_KEY=0x...
RELAYER_ADDRESS=0x...
```

### Turborepo Configuration

`turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "type-check": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

---

## Adding Features

### Adding a New Page

1. Create page file in `apps/frontend/app/`:
```tsx
// apps/frontend/app/my-page/page.tsx
export default function MyPage() {
  return <div>My new page</div>;
}
```

2. Add to navigation if needed in `components/layout/Header.tsx`

### Adding a New Component

1. Create component in appropriate directory:
```tsx
// apps/frontend/components/ui/MyComponent.tsx
interface MyComponentProps {
  title: string;
}

export function MyComponent({ title }: MyComponentProps) {
  return <div className="...">{title}</div>;
}
```

2. Export from index if exists:
```tsx
// apps/frontend/components/ui/index.ts
export * from './MyComponent';
```

### Adding a New Hook

```tsx
// apps/frontend/hooks/use-my-feature.ts
'use client';

import { useState, useEffect } from 'react';

export function useMyFeature() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch data
    setIsLoading(false);
  }, []);

  return { data, isLoading };
}
```

### Adding a New API Route

```tsx
// apps/frontend/app/api/my-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'Hello' });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  // Process body
  return NextResponse.json({ success: true });
}
```

### Adding a New Schema

```typescript
// packages/shared-types/src/my-schema.ts
import { z } from 'zod';

export const MySchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  createdAt: z.number().int().positive(),
});

export type MyType = z.infer<typeof MySchema>;
```

Don't forget to export from index:
```typescript
// packages/shared-types/src/index.ts
export * from './my-schema';
```

### Adding Contract Functions

1. Update contract in `contracts/src/`:
```cairo
#[external]
fn my_new_function(arg: felt252) -> u256 {
    // Implementation
}
```

2. Add tests in `contracts/tests/`:
```cairo
#[test]
fn test_my_new_function() {
    // Test implementation
}
```

3. Update ABI in `packages/web3-utils/src/abis/`

4. Add wrapper in `packages/web3-utils/src/starknet.ts`:
```typescript
export async function myNewFunction(arg: string): Promise<bigint> {
  const result = await contract.my_new_function(arg);
  return result;
}
```

---

## Testing

### Frontend Testing

```bash
cd apps/frontend

# Type checking
pnpm type-check

# Linting
pnpm lint

# E2E tests (planned)
pnpm test:e2e
```

### Contract Testing

```bash
cd contracts

# Run all tests
snforge test

# Run specific test file
snforge test test_blog_registry

# Run with gas reporting
snforge test --gas-report

# Run with coverage (if available)
snforge test --coverage
```

### Test Structure

```
contracts/tests/
├── test_role_registry.cairo
├── test_blog_registry.cairo
├── test_social.cairo
├── test_treasury.cairo
└── test_reputation.cairo
```

### Writing Good Tests

```cairo
#[test]
fn test_feature_description() {
    // 1. Setup - deploy contracts, create accounts
    let (contracts, accounts) = setup();

    // 2. Arrange - set up preconditions
    contracts.role_registry.grant_role(accounts.alice, ROLE_WRITER);

    // 3. Act - perform the action
    start_prank(CheatTarget::One(contracts.blog.contract_address), accounts.alice);
    let result = contracts.blog.publish_post(...);
    stop_prank(CheatTarget::One(contracts.blog.contract_address));

    // 4. Assert - verify outcomes
    assert(result == expected, 'Unexpected result');
}

#[test]
#[should_panic(expected: ('Insufficient permissions',))]
fn test_unauthorized_access() {
    // Test that unauthorized users cannot perform action
    let (contracts, accounts) = setup();

    // Try action without permission - should panic
    start_prank(CheatTarget::One(contracts.blog.contract_address), accounts.bob);
    contracts.blog.approve_post(1);  // Bob is Reader, needs Editor
}
```

---

## Debugging

### Frontend Debugging

1. **Browser DevTools**
   - React DevTools for component inspection
   - Network tab for API calls
   - Console for errors

2. **Next.js Debug Mode**
   ```bash
   NODE_OPTIONS='--inspect' pnpm dev
   ```

3. **Add Debug Logging**
   ```typescript
   console.log('[DEBUG] State:', state);
   ```

### Contract Debugging

1. **Add Print Statements** (snforge only)
   ```cairo
   use debug::PrintTrait;
   value.print();  // Prints to test output
   ```

2. **Check Transaction Logs**
   ```bash
   starkli tx-receipt <TX_HASH> --rpc http://localhost:9944
   ```

3. **View Contract State**
   ```bash
   starkli call <CONTRACT> get_post 1 --rpc http://localhost:9944
   ```

### Docker Debugging

```bash
# View logs
docker logs -f vauban-madara-l3
docker logs -f vauban-ipfs
docker logs -f vauban-redis

# Enter container
docker exec -it vauban-madara-l3 /bin/bash

# Check resource usage
docker stats
```

---

## Code Style

### TypeScript

- Use strict TypeScript (`"strict": true`)
- Prefer `interface` over `type` for objects
- Use descriptive variable names
- Add JSDoc comments for public functions
- Avoid `any` - use `unknown` if needed

```typescript
// Good
interface UserProfile {
  /** Unique user address */
  address: string;
  /** Display name (optional) */
  displayName?: string;
}

/**
 * Fetch user profile from contract
 * @param address - Starknet address
 * @returns User profile or null if not found
 */
export async function getUserProfile(address: string): Promise<UserProfile | null> {
  // Implementation
}
```

### Cairo

- Follow Starknet naming conventions
- Use descriptive function and variable names
- Add comments for complex logic
- Keep functions focused and small

```cairo
/// Publish a new post to the blog
///
/// # Arguments
/// * `arweave_tx_id` - Arweave transaction ID for permanent storage
/// * `ipfs_cid` - IPFS CID for fast retrieval
/// * `content_hash` - SHA256 hash of content for verification
///
/// # Returns
/// * `u256` - The newly created post ID
#[external]
fn publish_post(
    arweave_tx_id: ByteArray,
    ipfs_cid: ByteArray,
    content_hash: felt252,
) -> u256 {
    // Implementation
}
```

### React Components

- Use functional components with hooks
- Prefer composition over inheritance
- Keep components focused (single responsibility)
- Use TypeScript for props

```tsx
interface ArticleCardProps {
  post: Post;
  onLike?: (postId: bigint) => void;
}

export function ArticleCard({ post, onLike }: ArticleCardProps) {
  return (
    <article className="border rounded-lg p-4">
      <h2>{post.title}</h2>
      {onLike && (
        <button onClick={() => onLike(post.id)}>
          Like
        </button>
      )}
    </article>
  );
}
```

---

## Git Workflow

### Branch Naming

```
feature/add-user-dashboard
fix/comment-loading-error
docs/update-api-reference
refactor/simplify-role-checks
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add user dashboard with earnings display
fix: resolve comment loading race condition
docs: update API reference for M2M endpoints
refactor: simplify role permission checks
test: add tests for treasury distribution
chore: update dependencies
```

### Pull Request Process

1. Create feature branch from `main`
2. Make changes with meaningful commits
3. Run tests locally (`pnpm test`)
4. Run lint (`pnpm lint`)
5. Create PR with description
6. Request review
7. Address feedback
8. Squash and merge

### PR Template

```markdown
## Summary
Brief description of changes

## Changes
- Change 1
- Change 2

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Screenshots (if applicable)
```

---

## Troubleshooting

### Common Issues

**Issue**: `pnpm install` fails
```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

**Issue**: Contracts won't compile
```bash
# Clean and rebuild
cd contracts
scarb clean
scarb build
```

**Issue**: Docker containers not starting
```bash
# Reset Docker
pnpm docker:down
docker system prune -f
pnpm docker:up
```

**Issue**: Frontend can't connect to contracts
```bash
# Verify .env.local has correct addresses
cat apps/frontend/.env.local

# Re-deploy contracts
pnpm contracts:deploy

# Restart frontend
cd apps/frontend && pnpm dev
```

**Issue**: IPFS content not accessible
```bash
# Check IPFS is running
docker logs vauban-ipfs

# Test gateway
curl http://localhost:8080/ipfs/QmTest...

# Restart IPFS
docker-compose restart ipfs
```

### Getting Help

1. Check existing issues on GitHub
2. Search documentation
3. Ask in Discord (link TBD)
4. Create a new issue with:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details

---

## Performance Tips

### Frontend

- Use React Server Components where possible
- Implement proper loading states
- Lazy load heavy components
- Optimize images with next/image
- Use React Query for data fetching

### Contracts

- Minimize storage writes (expensive)
- Batch reads when possible
- Use events for historical data
- Keep functions focused and simple

### IPFS

- Pin content immediately after upload
- Use local IPFS node for development
- Implement fallback to Arweave gateway

---

## Resources

### Documentation

- [Next.js 15 Docs](https://nextjs.org/docs)
- [Starknet Docs](https://docs.starknet.io)
- [Cairo Book](https://book.cairo-lang.org)
- [starknet.js Docs](https://www.starknetjs.com)
- [IPFS Docs](https://docs.ipfs.tech)
- [Arweave Docs](https://docs.arweave.org)

### Tools

- [Voyager](https://voyager.online) - Starknet block explorer
- [Starkscan](https://starkscan.co) - Alternative explorer
- [Cairo Playground](https://www.cairo-lang.org/playground)

### Community

- GitHub Issues
- Discord Server (TBD)
- Twitter: [@VaubanBlog](https://twitter.com/VaubanBlog)
