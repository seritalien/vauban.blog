# Testing Guide - Vauban Blog

Comprehensive testing procedures for the decentralized publishing platform.

## Test Environment Setup

### 1. Start Local Devnet

```bash
# Terminal 1: Start Madara L3 + IPFS + Redis
./scripts/start-devnet.sh

# Wait for services to be healthy
# Expected: ✅ Madara L3 is running! (after ~60s)
```

### 2. Deploy Contracts

```bash
# Terminal 2: Deploy smart contracts
./contracts/scripts/deploy.sh

# Verify deployment
cat .deployments.json
# Should show 4 contract addresses

# Check contracts are responding
starkli call $(cat .deployments.json | jq -r '.contracts.BlogRegistry') get_post_count \
  --rpc http://localhost:9944
# Expected: 0
```

### 3. Start Frontend

```bash
# Terminal 3: Start Next.js dev server
cd apps/frontend
pnpm dev

# Open http://localhost:3000
```

## Manual Test Cases

### Test Suite 1: Wallet Connection

**TC1.1: Connect Wallet (ArgentX)**
- **Steps**:
  1. Open http://localhost:3000
  2. Click "Connect Wallet" button
  3. Select ArgentX from Starknetkit modal
  4. Approve connection in ArgentX extension
- **Expected**:
  - Button changes to show truncated address (e.g., "0x1234...5678")
  - "Admin" link appears in header
  - localStorage key `wallet_connected` is set

**TC1.2: Auto-Reconnect on Page Reload**
- **Pre-condition**: Wallet already connected (TC1.1)
- **Steps**:
  1. Reload page (Cmd+R / Ctrl+R)
  2. Wait 2 seconds
- **Expected**:
  - Wallet reconnects automatically
  - Address displayed without user action
  - No wallet popup shown

**TC1.3: Disconnect Wallet**
- **Pre-condition**: Wallet connected
- **Steps**:
  1. Click "Disconnect" button
- **Expected**:
  - Button changes back to "Connect Wallet"
  - "Admin" link disappears
  - localStorage cleared

### Test Suite 2: Publishing Article

**TC2.1: Publish Free Article**
- **Pre-condition**: Wallet connected, Admin page open
- **Steps**:
  1. Navigate to `/admin`
  2. Fill form:
     - Title: "Test Article 1"
     - Slug: "test-article-1"
     - Excerpt: "This is a test excerpt for validation purposes."
     - Content: "# Test Article\n\nThis is test content with **markdown**."
     - Tags: "test, blockchain, web3"
     - Paid: unchecked
  3. Click "Publish Article"
  4. Sign transaction in wallet
  5. Wait for confirmation
- **Expected**:
  - Status updates: "Validating..." → "Uploading to IPFS..." → "Publishing to blockchain..."
  - Transaction hash logged to console
  - Redirect to homepage after 2 seconds
  - Article visible in grid

**TC2.2: Publish Paid Article**
- **Steps**: Same as TC2.1 but:
  - Check "Paid Article"
  - Set Price: 5 (STRK)
- **Expected**:
  - Article card shows "5 STRK" badge
  - On-chain price stored as 5000000000000000000 (5e18 Wei)

**TC2.3: Validation Error - Missing Fields**
- **Steps**:
  1. Navigate to `/admin`
  2. Fill only Title: "Incomplete"
  3. Click "Publish"
- **Expected**:
  - Red error message: "Zod validation error"
  - Form not submitted
  - No blockchain transaction

**TC2.4: IPFS Upload Verification**
- **Pre-condition**: Article published (TC2.1)
- **Steps**:
  1. Check console logs for IPFS CID
  2. Visit: http://localhost:8080/ipfs/[CID]
- **Expected**:
  - JSON response with article content
  - Matches original form data

### Test Suite 3: Reading Articles

**TC3.1: Homepage Article List**
- **Pre-condition**: 3 articles published
- **Steps**:
  1. Navigate to homepage (/)
  2. Scroll through article grid
- **Expected**:
  - Articles displayed in reverse chronological order (newest first)
  - Each card shows: title, excerpt, tags (max 3), timestamp
  - Cover images render if provided
  - Loading spinner shown initially

**TC3.2: Article Detail View**
- **Pre-condition**: Article published
- **Steps**:
  1. Click article card on homepage
  2. Navigate to `/articles/[slug]`
  3. Wait for content to load
- **Expected**:
  - Full article content rendered as Markdown
  - Syntax highlighting works (if code blocks present)
  - Tags displayed above title
  - Timestamp formatted correctly
  - Arweave + IPFS links visible and clickable

**TC3.3: IPFS Fallback to Arweave**
- **Steps**:
  1. Stop IPFS container: `docker stop vauban-ipfs`
  2. Open article detail page
  3. Observe network tab (DevTools)
- **Expected**:
  - IPFS fetch fails (HTTP 502/504)
  - Arweave fetch succeeds after 3-5 seconds
  - Article content displays correctly
  - Warning logged: "IPFS fetch failed, trying Arweave..."

**TC3.4: Content Integrity Verification**
- **Steps**:
  1. Open article detail page
  2. Open DevTools → Console
  3. Look for hash verification logs
- **Expected**:
  - Console log: "Content hash verified: 0x..."
  - No tampering warnings
  - SHA256(content) === on-chain contentHash

### Test Suite 4: Comments (Phase 5)

**TC4.1: View Comments (Not Connected)**
- **Pre-condition**: Wallet disconnected
- **Steps**:
  1. Open article detail page
  2. Scroll to comments section
- **Expected**:
  - Message: "Connect your wallet to comment"
  - Existing comments visible
  - Comment count displayed

**TC4.2: Post First Comment (Session Key Creation)**
- **Pre-condition**: Wallet connected, no session key
- **Steps**:
  1. Scroll to comments section
  2. Type comment: "Great article!"
  3. Click "Post Comment"
  4. Sign session key authorization in wallet (one-time)
- **Expected**:
  - Wallet popup: "Authorize session key for 7 days"
  - After signing: localStorage key `session_key` created
  - Comment submitted to blockchain
  - Transaction hash logged
  - Comment appears in list after block confirmation

**TC4.3: Post Second Comment (Gasless)**
- **Pre-condition**: Session key created (TC4.2)
- **Steps**:
  1. Type another comment: "Testing gasless comments"
  2. Click "Post Comment"
- **Expected**:
  - NO wallet popup (session key signs automatically)
  - Comment submitted without user interaction
  - Gas sponsored by Paymaster
  - Comment appears in list

**TC4.4: Paymaster Daily Limit Reached**
- **Pre-condition**: User posted 100 comments today (unlikely in testing)
- **Steps**:
  1. Try to post 101st comment
- **Expected**:
  - Error: "User daily limit exceeded"
  - Comment not posted
  - Alert shown to user

**TC4.5: Session Key Expiry**
- **Steps**:
  1. Manually edit localStorage: Set `session_key.expiry` to past timestamp
  2. Try to post comment
- **Expected**:
  - Wallet popup appears again (session key expired)
  - New session key created after signing

### Test Suite 5: Storage Verification

**TC5.1: Arweave Permanent Storage**
- **Pre-condition**: Article published with Arweave TX ID
- **Steps**:
  1. Extract Arweave TX ID from .deployments.json or article detail page
  2. Visit: https://arweave.net/[TX_ID]
- **Expected**:
  - Article content returned as JSON
  - HTTP 200 status
  - Content-Type: application/json
  - Note: May take 30-60s for TX to propagate on testnet

**TC5.2: IPFS Local Node**
- **Steps**:
  1. Check IPFS node info:
     ```bash
     curl http://localhost:5001/api/v0/id
     ```
  2. List pinned content:
     ```bash
     curl http://localhost:5001/api/v0/pin/ls
     ```
- **Expected**:
  - Node ID returned (26-character peer ID)
  - Pinned CIDs include published articles

**TC5.3: Content Hash Integrity**
- **Steps**:
  1. Fetch article from IPFS
  2. Calculate SHA256 hash:
     ```bash
     curl http://localhost:8080/ipfs/[CID] | sha256sum
     ```
  3. Compare with on-chain hash:
     ```bash
     starkli call $BLOG_REGISTRY get_post 1 --rpc http://localhost:9944 | grep content_hash
     ```
- **Expected**:
  - Hashes match exactly
  - No tampering detected

### Test Suite 6: Contract Interactions

**TC6.1: BlogRegistry - Get Post Count**
```bash
starkli call $BLOG_REGISTRY_ADDRESS get_post_count --rpc http://localhost:9944
```
- **Expected**: Number of published posts (e.g., 3)

**TC6.2: BlogRegistry - Get Post Metadata**
```bash
starkli call $BLOG_REGISTRY_ADDRESS get_post 1 --rpc http://localhost:9944
```
- **Expected**:
  ```
  [
    1,                           // id
    "0x...",                     // author
    "0x...",                     // arweave_tx_id
    "0x...",                     // ipfs_cid
    "0x...",                     // content_hash
    "5000000000000000000",       // price (5 STRK)
    false,                       // is_encrypted
    1642345678,                  // created_at
    1642345678,                  // updated_at
    false                        // is_deleted
  ]
  ```

**TC6.3: Social - Get Comments**
```bash
starkli call $SOCIAL_ADDRESS get_comments_for_post 1 50 0 --rpc http://localhost:9944
```
- **Expected**: Array of Comment structs

**TC6.4: Paymaster - Check Balance**
```bash
starkli call $PAYMASTER_ADDRESS get_balance --rpc http://localhost:9944
```
- **Expected**: Balance in Wei (e.g., 100000000000000000000 = 100 STRK)

**TC6.5: SessionKeyManager - Validate Session Key**
```bash
starkli call $SESSION_KEY_MANAGER_ADDRESS is_session_key_valid [key] --rpc http://localhost:9944
```
- **Expected**: true (if valid) or false (if expired/revoked)

### Test Suite 7: Madara Settlement

**TC7.1: Verify Settlement to Sepolia**
- **Pre-condition**: Madara configured with settlement enabled
- **Steps**:
  1. Check Madara logs:
     ```bash
     docker logs vauban-madara-l3 | grep settlement
     ```
  2. Wait for 100 L3 blocks (~10 minutes)
  3. Check Sepolia block explorer for settlement TX
- **Expected**:
  - Log: "Settling block 100 to Sepolia..."
  - Settlement TX visible on Sepolia explorer
  - L3 state root updated on L2 contract

**TC7.2: Settlement Failure Retry**
- **Steps**:
  1. Temporarily disconnect Sepolia RPC (edit config)
  2. Wait for settlement interval
  3. Check logs for retry attempts
- **Expected**:
  - Error: "Settlement failed: RPC unreachable"
  - Retry after 30s (max 3 retries)
  - Success log after reconnection

## Performance Benchmarks

### Latency Targets

| Operation | Target | Acceptable Range |
|-----------|--------|------------------|
| Homepage Load | <2s | <5s |
| IPFS Content Fetch | <200ms | <500ms |
| Arweave Fallback | <5s | <10s |
| Comment Submit | <10s | <15s (with block time) |
| Contract Query | <100ms | <300ms |
| Madara Block Time | 6s | 6-8s |

### Load Testing

**Concurrent Users**:
```bash
# Install Apache Bench
apt-get install apache2-utils

# Test homepage (10 concurrent users, 100 requests)
ab -n 100 -c 10 http://localhost:3000/

# Expected:
# - Mean time per request: <2000ms
# - Failed requests: 0
```

**IPFS Gateway Stress Test**:
```bash
# Test IPFS gateway with 50 concurrent requests
ab -n 200 -c 50 http://localhost:8080/ipfs/[CID]

# Expected:
# - Mean time: <500ms
# - No 5xx errors
```

## Security Testing

### SC1: SQL Injection (N/A - No SQL)
- Blockchain storage prevents SQL injection
- All data validated with Zod before submission

### SC2: XSS Prevention
- **Test**: Enter `<script>alert('XSS')</script>` in comment
- **Expected**: Rendered as plain text (React auto-escapes)

### SC3: Reentrancy Attack
- **Test**: Call `publish_post` recursively before first TX completes
- **Expected**: Second call reverts with "Reentrancy detected"

### SC4: Content Tampering
- **Test**: Modify IPFS content after publishing
- **Expected**: Hash verification fails, content rejected

### SC5: Paymaster Drain Attack
- **Test**: Submit 1000 sponsored TXs in 1 minute
- **Expected**: Rate limit triggers after 10th TX

## Automated Test Scripts

### Run All Tests

```bash
# Coming soon: Automated E2E tests with Playwright
pnpm test:e2e

# Coming soon: Contract unit tests
pnpm contracts:test
```

## Troubleshooting Common Test Failures

### Frontend Build Errors

**Error**: `Module not found: Can't resolve '@vauban/shared-types'`
**Fix**:
```bash
cd packages/shared-types
pnpm build
cd ../../apps/frontend
pnpm dev
```

### Wallet Connection Fails

**Error**: `No wallet detected`
**Fix**:
- Install ArgentX or Braavos browser extension
- Refresh page after installation
- Check browser console for detailed errors

### Transaction Timeout

**Error**: `Transaction not confirmed after 60s`
**Fix**:
- Check Madara is running: `curl http://localhost:9944/health`
- Verify Madara is producing blocks: `docker logs vauban-madara-l3 | tail`
- Wait longer (settlement may delay block production)

### IPFS Content Not Found

**Error**: `Failed to fetch from IPFS: HTTP 404`
**Fix**:
- Check IPFS daemon: `docker ps | grep ipfs`
- Restart IPFS: `docker-compose restart ipfs`
- Pin content manually:
  ```bash
  docker exec vauban-ipfs ipfs pin add [CID]
  ```

## Test Coverage Goals

- [ ] Unit tests: 80%+ coverage (contracts)
- [ ] Integration tests: All critical paths
- [ ] E2E tests: 5 key user journeys
- [ ] Performance tests: All latency targets met
- [ ] Security tests: OWASP Top 10 mitigations verified

## CI/CD Pipeline (Future)

```yaml
# .github/workflows/test.yml (planned)
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm contracts:build
      - run: pnpm test:unit
      - run: pnpm test:integration
```

## Bug Reporting

When reporting bugs, include:

1. **Environment**: OS, browser, wallet version
2. **Steps to reproduce**: Detailed sequence
3. **Expected behavior**: What should happen
4. **Actual behavior**: What actually happened
5. **Logs**: Browser console + Docker logs
6. **Screenshots**: If UI-related

**Example**:
```
**Bug**: Comment submit fails with "Insufficient balance"

**Environment**:
- OS: macOS 14.2
- Browser: Chrome 120
- Wallet: ArgentX 5.7.0
- Madara: v0.7.0

**Steps**:
1. Connect wallet
2. Open article detail
3. Type comment "Test"
4. Click "Post Comment"

**Expected**: Comment posted successfully
**Actual**: Error: "Insufficient balance" in Paymaster

**Logs**:
[PaymasterError] Balance: 0, Required: 1000000000000

**Fix**: Fund Paymaster contract with STRK
```

---

**Last Updated**: 2026-01-18
**Test Coverage**: 85% (manual), 0% (automated) - TODO: Add Playwright E2E tests
