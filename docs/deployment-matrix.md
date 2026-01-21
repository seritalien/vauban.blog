# Vauban Blog - Deployment Compatibility Matrix

## Version Compatibility

| Component | Current Version | Required For | Notes |
|-----------|----------------|--------------|-------|
| **Scarb** | 2.9.4 | Sierra 1.6.0 | Use `asdf set scarb 2.9.4` |
| **Cairo** | 2.9.4 | Madara compatibility | Comes with Scarb |
| **Sierra** | 1.6.0 | Madara v0.7.0 | Scarb 2.15+ outputs 1.7.0 (incompatible) |
| **Starkli** | 0.4.2 | Contract deployment | Works with Madara 0.7.1 specs |
| **Madara** | v0.7.0 | L3 sequencer | Supports Sierra 1.6.0 only |
| **starknet.js** | 6.x | Frontend integration | ABI format must match |

## Known Incompatibilities

| Issue | Symptoms | Solution |
|-------|----------|----------|
| Sierra version mismatch | `Cannot compile Sierra version 1.7.0 with compiler 1.6.0` | Use Scarb 2.9.4 instead of 2.15+ |
| starkli specs mismatch | Warning about specs 0.7.1 vs 0.8.1 | Usually works, ignore warning |
| ABI format mismatch | `Property 'abi' does not exist` | Extract `.abi` from contract_class.json |
| u256 parsing error | `high is out of range UINT_256_HIGH_MIN` | Redeploy with matching ABI |

## Scarb Version Selection

```bash
# Check available versions
asdf list scarb

# For Madara v0.7.0 (Sierra 1.6.0)
asdf set scarb 2.9.4

# For Madara v0.8+ (Sierra 1.7.0) - when available
asdf set scarb 2.15.1

# Verify
scarb --version
# Should show: sierra: 1.6.0
```

## Deployment Procedure

### Prerequisites

1. **Services running**:
   ```bash
   pnpm docker:up
   curl http://localhost:9944/health  # Should return "OK"
   ```

2. **Correct Scarb version**:
   ```bash
   cd contracts
   asdf set scarb 2.9.4
   scarb --version | grep sierra  # Must show 1.6.0
   ```

3. **Valid deployer account with private key**:
   ```bash
   # Account file: ~/.starknet_accounts/deployer.json
   # Private key must be available (not just public key!)
   ```

### Deployment Steps

```bash
# 1. Clean and rebuild contracts
cd contracts
rm -rf target
scarb build

# 2. Declare contract class
starkli declare target/dev/vauban_blog_BlogRegistry.contract_class.json \
  --rpc http://localhost:9944 \
  --account ~/.starknet_accounts/deployer.json \
  --private-key $DEPLOYER_PRIVATE_KEY

# 3. Deploy contract instance
starkli deploy <CLASS_HASH> <CONSTRUCTOR_ARGS> \
  --rpc http://localhost:9944 \
  --account ~/.starknet_accounts/deployer.json \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --watch

# 4. Update ABIs for frontend
jq -n --slurpfile abi contracts/target/dev/vauban_blog_BlogRegistry.contract_class.json \
  '{abi: $abi[0].abi}' > packages/web3-utils/src/abis/blog_registry.json

# 5. Rebuild web3-utils
cd ../packages/web3-utils && pnpm build

# 6. Update .env.local with new addresses
# NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS=<new_address>
```

### Post-Deployment Verification

```bash
# Check contract is accessible
node -e "
const { RpcProvider, Contract } = require('starknet');
const abi = require('./contracts/target/dev/vauban_blog_BlogRegistry.contract_class.json').abi;
const provider = new RpcProvider({ nodeUrl: 'http://localhost:9944' });
const contract = new Contract(abi, '<CONTRACT_ADDRESS>', provider);
contract.get_post_count().then(r => console.log('Post count:', r.toString()));
"
```

## M2M Publishing Setup

### Environment Variables (apps/frontend/.env.local)

```bash
# M2M API Key (generate with: openssl rand -base64 32)
M2M_API_KEY=vb_<your_generated_key>

# Relayer Account (must have funds for gas)
RELAYER_PRIVATE_KEY=<starknet_private_key>
RELAYER_ADDRESS=<starknet_address>
MADARA_RPC_URL=http://localhost:9944
```

### Testing M2M

```bash
# 1. Check API status
curl -s http://localhost:3005/api/m2m/publish \
  -H "X-API-Key: $M2M_API_KEY" | jq .

# 2. Dry-run publish
M2M_API_KEY=<key> pnpm publish:blog --dry-run

# 3. Actual publish
M2M_API_KEY=<key> pnpm publish:blog --skip-published
```

## Troubleshooting

### "Entry point not found" Error
The deployed contract doesn't have the function being called. This happens when:
- Contract ABI doesn't match deployed code
- Contract needs redeployment after code changes

**Solution**: Redeploy the contract and sync ABIs.

### "Invalid signature" Error
The private key doesn't match the account's public key.

**Solution**: Find the correct private key for the deployer account.

### Posts Not Showing on Frontend
1. Check console for errors (F12 in browser)
2. Verify contract addresses in `.env.local`
3. Check if ABIs are synced with deployed contracts
4. Restart frontend server after ABI changes

### IPFS Upload Fails
1. Check IPFS is running: `docker logs vauban-ipfs`
2. Test API: `curl http://localhost:5001/api/v0/id`
3. Check `/api/ipfs/add` route handles JSON content-type

## File Locations Reference

| File | Purpose |
|------|---------|
| `contracts/Scarb.toml` | Cairo project config |
| `contracts/target/dev/*.contract_class.json` | Compiled contracts |
| `packages/web3-utils/src/abis/*.json` | ABIs for frontend |
| `apps/frontend/.env.local` | Frontend config |
| `.deployments.json` | Deployed contract addresses |
| `content/blog/.published.json` | M2M published articles state |
| `~/.starknet_accounts/deployer.json` | Deployer account (no private key) |
