# Contract ABIs

This directory should contain the compiled contract ABIs in JSON format.

The ABIs are generated when deploying contracts and should be copied here.

## Required Files

- `blog_registry.json` - BlogRegistry contract ABI
- `social.json` - Social contract ABI
- `paymaster.json` - Paymaster contract ABI
- `session_key_manager.json` - SessionKeyManager contract ABI

## How to Generate

After deploying contracts with `./contracts/scripts/deploy.sh`, copy the ABI files:

```bash
# Copy ABIs from compiled contracts
cp contracts/target/dev/vauban_blog_BlogRegistry.contract_class.json \
   packages/web3-utils/src/abis/blog_registry.json

cp contracts/target/dev/vauban_blog_Social.contract_class.json \
   packages/web3-utils/src/abis/social.json

cp contracts/target/dev/vauban_blog_Paymaster.contract_class.json \
   packages/web3-utils/src/abis/paymaster.json

cp contracts/target/dev/vauban_blog_SessionKeyManager.contract_class.json \
   packages/web3-utils/src/abis/session_key_manager.json
```

Or use the automated script:

```bash
# From project root
./scripts/copy-abis.sh
```
