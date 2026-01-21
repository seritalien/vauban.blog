# Deployment Guide

This guide covers deploying Vauban Blog to production environments.

---

## Deployment Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      PRODUCTION ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      CDN / Edge                              │   │
│  │              (Vercel, Cloudflare, etc.)                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Next.js Application                       │   │
│  │                    (Vercel / Docker)                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│          ┌───────────────────┼───────────────────┐                  │
│          ▼                   ▼                   ▼                   │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────┐         │
│  │  Madara L3    │   │    IPFS       │   │    Redis      │         │
│  │  (Dedicated)  │   │   (Pinata)    │   │   (Upstash)   │         │
│  └───────────────┘   └───────────────┘   └───────────────┘         │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      Arweave                                 │   │
│  │              (Permanent Storage)                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### Required Accounts

| Service | Purpose | Link |
|---------|---------|------|
| Vercel | Frontend hosting | [vercel.com](https://vercel.com) |
| Pinata | IPFS pinning | [pinata.cloud](https://pinata.cloud) |
| Upstash | Serverless Redis | [upstash.com](https://upstash.com) |
| ArDrive | Arweave wallet | [ardrive.io](https://ardrive.io) |
| Infura/Alchemy | Starknet RPC | [infura.io](https://infura.io) |

### Required Keys

- Arweave JWK wallet (for content uploads)
- Pinata API key (for IPFS pinning)
- Upstash Redis credentials
- Starknet RPC URL
- Deployer wallet private key

---

## Contract Deployment

### 1. Prepare Deployer Account

Create a Starknet account for deployment:

```bash
# Generate account
starkli account oz init deployer --rpc $RPC_URL

# Deploy account
starkli account deploy deployer --rpc $RPC_URL

# Fund account with ETH for deployment gas
# Transfer ETH from faucet or exchange
```

### 2. Configure Deployment

Create deployment configuration:

```bash
# contracts/.env
RPC_URL=https://starknet-sepolia.infura.io/v3/YOUR_KEY
ACCOUNT_FILE=~/.starknet_accounts/deployer.json
ACCOUNT_ADDRESS=0x...
NETWORK=sepolia  # or mainnet
```

### 3. Build Contracts

```bash
cd contracts
scarb build
```

### 4. Deploy Contracts

```bash
# Deploy all contracts in order
bash scripts/deploy.sh --network sepolia

# Or deploy individually
starkli deploy \
  ./target/dev/vauban_RoleRegistry.contract_class.json \
  --rpc $RPC_URL \
  --account $ACCOUNT_FILE \
  $DEPLOYER_ADDRESS  # constructor arg: initial owner
```

### 5. Verify Deployment

```bash
# Check deployment file
cat .deployments.json

# Verify contracts are accessible
starkli call $ROLE_REGISTRY_ADDRESS get_role $OWNER_ADDRESS --rpc $RPC_URL
```

### 6. Post-Deployment Configuration

```bash
# Whitelist Social contract in Paymaster
starkli invoke $PAYMASTER_ADDRESS whitelist_contract $SOCIAL_ADDRESS --rpc $RPC_URL --account $ACCOUNT_FILE

# Fund Paymaster for gas sponsorship
starkli invoke $ETH_ADDRESS transfer $PAYMASTER_ADDRESS $AMOUNT --rpc $RPC_URL --account $ACCOUNT_FILE
```

---

## Frontend Deployment

### Option 1: Vercel (Recommended)

#### 1. Connect Repository

1. Go to [vercel.com](https://vercel.com)
2. Import Git repository
3. Select `apps/frontend` as root directory
4. Configure build settings:
   - Framework: Next.js
   - Build Command: `pnpm build`
   - Output Directory: `.next`

#### 2. Configure Environment Variables

In Vercel dashboard, add:

```
# Contract Addresses
NEXT_PUBLIC_ROLE_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_SOCIAL_ADDRESS=0x...
NEXT_PUBLIC_TREASURY_ADDRESS=0x...
NEXT_PUBLIC_REPUTATION_ADDRESS=0x...
NEXT_PUBLIC_PAYMASTER_ADDRESS=0x...
NEXT_PUBLIC_SESSION_KEY_MANAGER_ADDRESS=0x...

# Network
NEXT_PUBLIC_STARKNET_RPC=https://starknet-sepolia.infura.io/v3/KEY
NEXT_PUBLIC_CHAIN_ID=0x534e5f5345504f4c4941

# IPFS
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud
PINATA_API_KEY=...
PINATA_SECRET_KEY=...

# Arweave
ARWEAVE_KEY={"kty":"RSA",...}

# M2M API
M2M_API_KEY=generate-secure-key

# Relayer
RELAYER_PRIVATE_KEY=0x...
RELAYER_ADDRESS=0x...

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

#### 3. Deploy

```bash
# Automatic deployment on push to main
git push origin main

# Or manual deployment
vercel --prod
```

#### 4. Configure Domain

1. In Vercel dashboard, go to Settings → Domains
2. Add custom domain (e.g., `vauban.blog`)
3. Configure DNS records as instructed

### Option 2: Docker Deployment

#### 1. Build Docker Image

```dockerfile
# apps/frontend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

#### 2. Build and Push

```bash
# Build
docker build -t vauban-frontend:latest -f apps/frontend/Dockerfile .

# Tag for registry
docker tag vauban-frontend:latest ghcr.io/your-org/vauban-frontend:latest

# Push
docker push ghcr.io/your-org/vauban-frontend:latest
```

#### 3. Deploy to Server

```bash
# On production server
docker pull ghcr.io/your-org/vauban-frontend:latest

docker run -d \
  --name vauban-frontend \
  -p 3000:3000 \
  --env-file .env.production \
  ghcr.io/your-org/vauban-frontend:latest
```

---

## Infrastructure Setup

### Madara L3 Node

For production, run a dedicated Madara node:

#### Option 1: Self-Hosted

```bash
# Clone Madara
git clone https://github.com/madara-alliance/madara

# Build
cargo build --release

# Run
./target/release/madara \
  --name vauban-l3 \
  --base-path /data/madara \
  --rpc-port 9944 \
  --rpc-cors all \
  --settlement-rpc-url $SEPOLIA_RPC_URL
```

#### Option 2: Managed Service

Use a managed Madara service provider (contact Madara team for options).

### IPFS with Pinata

1. Create account at [pinata.cloud](https://pinata.cloud)
2. Get API keys from dashboard
3. Configure in environment:

```env
PINATA_API_KEY=your-api-key
PINATA_SECRET_KEY=your-secret-key
```

### Redis with Upstash

1. Create account at [upstash.com](https://upstash.com)
2. Create a Redis database
3. Get connection URL:

```env
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

### Arweave Wallet

1. Create wallet at [ardrive.io](https://ardrive.io)
2. Export JWK key
3. Fund wallet with AR tokens
4. Add to environment:

```env
ARWEAVE_KEY={"kty":"RSA","n":"...","e":"...","d":"..."}
```

---

## Security Checklist

### Secrets Management

- [ ] All secrets in environment variables (not code)
- [ ] Different secrets for staging/production
- [ ] Secrets rotated regularly
- [ ] No secrets in git history

### Contract Security

- [ ] Contracts audited before mainnet
- [ ] Owner address is multisig
- [ ] Emergency pause function tested
- [ ] Upgrade mechanism tested on testnet

### API Security

- [ ] Rate limiting enabled
- [ ] API keys are secure (32+ characters)
- [ ] CORS properly configured
- [ ] Input validation on all endpoints

### Infrastructure Security

- [ ] HTTPS everywhere
- [ ] DDoS protection (Cloudflare/Vercel)
- [ ] Regular backups
- [ ] Monitoring and alerting

---

## Monitoring

### Health Checks

Set up monitoring for:

```bash
# Frontend
curl https://vauban.blog/api/health

# Madara RPC
curl $STARKNET_RPC/health

# IPFS
curl $IPFS_GATEWAY/ipfs/QmTest...
```

### Metrics to Monitor

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Frontend response time | <500ms | >2s |
| Contract call latency | <6s | >15s |
| IPFS fetch time | <500ms | >2s |
| Error rate | <1% | >5% |
| Paymaster balance | >0.1 ETH | <0.01 ETH |

### Recommended Tools

- **Uptime**: UptimeRobot, Pingdom
- **APM**: Vercel Analytics, Sentry
- **Logs**: Vercel Logs, Datadog
- **Alerts**: PagerDuty, Opsgenie

---

## Backup & Recovery

### What to Backup

| Data | Location | Frequency |
|------|----------|-----------|
| Contract addresses | `.deployments.json` | On deploy |
| Deployer keys | Secure vault | Initial setup |
| Arweave wallet | Secure vault | Initial setup |
| Environment configs | Secure vault | On change |

### Disaster Recovery

1. **Frontend down**: Vercel auto-recovers; deploy backup if needed
2. **Madara node down**: Switch to backup node; content still accessible via IPFS/Arweave
3. **IPFS unavailable**: Arweave fallback activates automatically
4. **Contract bug**: Use emergency pause, deploy fix, upgrade

---

## Upgrade Procedures

### Frontend Updates

```bash
# Test on staging
vercel --env staging

# Deploy to production
vercel --prod

# Rollback if needed
vercel rollback
```

### Contract Upgrades

1. **Test on Testnet**
   ```bash
   # Deploy new version to testnet
   scarb build
   bash scripts/deploy.sh --network sepolia-test

   # Run integration tests
   pnpm test:e2e
   ```

2. **Audit Changes**
   - Internal review
   - External audit for major changes

3. **Deploy to Production**
   ```bash
   # Deploy new contract class
   starkli declare ./target/dev/vauban_BlogRegistry_v2.contract_class.json

   # Upgrade existing contract
   starkli invoke $BLOG_REGISTRY upgrade $NEW_CLASS_HASH
   ```

4. **Verify**
   ```bash
   starkli call $BLOG_REGISTRY get_version
   ```

---

## Cost Estimation

### Monthly Costs (Estimated)

| Service | Tier | Cost |
|---------|------|------|
| Vercel | Pro | $20/month |
| Upstash Redis | Pay-as-you-go | ~$10/month |
| Pinata | Starter | Free (1GB) |
| Madara Node | Self-hosted | VPS: $40/month |
| Arweave | Per upload | ~$5/GB (one-time) |
| Domain | Annual | ~$15/year |

**Total**: ~$70-100/month + Arweave uploads

### Gas Costs

| Action | Estimated Gas | Cost (ETH) |
|--------|---------------|------------|
| Publish post | ~200k | ~0.001 |
| Comment | ~100k | ~0.0005 |
| Like | ~50k | ~0.00025 |

Paymaster should be funded with 0.1+ ETH for ~100+ sponsored transactions.

---

## Staging Environment

### Setup Staging

1. **Deploy contracts to Sepolia testnet**
   ```bash
   bash scripts/deploy.sh --network sepolia
   ```

2. **Create Vercel staging**
   ```bash
   vercel --env staging
   ```

3. **Configure staging URLs**
   - `staging.vauban.blog`
   - Separate environment variables

### Testing in Staging

Before production deployment:
- [ ] All pages load correctly
- [ ] Wallet connection works
- [ ] Publishing flow works
- [ ] Comments work (gasless)
- [ ] Admin functions work
- [ ] Error handling works

---

## Production Checklist

### Pre-Launch

- [ ] Contracts deployed and verified
- [ ] Owner is multisig wallet
- [ ] Paymaster funded
- [ ] Frontend deployed
- [ ] Domain configured
- [ ] SSL certificate active
- [ ] Monitoring configured
- [ ] Backups configured
- [ ] Documentation complete

### Post-Launch

- [ ] Monitor error rates
- [ ] Check Paymaster balance daily
- [ ] Review user feedback
- [ ] Plan first update cycle

---

## Support

### Incident Response

1. **Identify**: Check monitoring alerts
2. **Communicate**: Update status page
3. **Investigate**: Review logs
4. **Fix**: Deploy fix or rollback
5. **Document**: Post-mortem

### Contact

- GitHub Issues for bugs
- Discord for community support
- Email: support@vauban.blog (TBD)
