# Madara Devnet Accounts

These are the pre-funded accounts available on the Madara L3 devnet.

## Primary Development Accounts

### Dev Account #1 (Deployer)
- **Address**: `0x3bb306a004034dba19e6cf7b161e7a4fef64bc1078419e8ad1876192f0b8cd1`
- **Private Key**: `0x76f2ccdb23f29bc7b69278e947c01c6160a31cf02c19d06d0f6e5ab1d768b86`
- **Public Key**: `0x002c518a19776fa3f62a74bfce0e8b2e19e3ee489cf65313fd3a52cefd1a2d00`
- **Balance**: 10,000 STRK, ~10,000 ETH
- **Class Hash**: `0x6fd07cc9fa064074ddf41e67db0f8f7883a04a2be0d908feffa40badca1d7b1`
- **Usage**: Contract deployment, admin operations, M2M relayer

### Dev Account #2
- **Address**: `0x5e9e93c6235f8ae6c2f4f0069bd30753ec21b26fbad80cfbf5da2c1bc573d69`
- **Private Key**: `0x11830d3641a682d4a690dcc25d1f4b0dac948325ac18f6dd32564371735f320`
- **Public Key**: `0x02c753a75682bb8f54588dce55ce1ab59605df58e84bd5a5d1f61381b9e71715`
- **Balance**: 10,000 STRK, ~10,000 ETH
- **Class Hash**: `0x6fd07cc9fa064074ddf41e67db0f8f7883a04a2be0d908feffa40badca1d7b1`
- **Usage**: Testing, secondary user operations

## Additional Pre-funded Accounts

| # | Address | Private Key |
|---|---------|-------------|
| 3 | `0x1f7cccfc0ae200cf667fe8c842ca24dfc8790409a04e217f0ffc2ad7def6bda` | `0x7bec814b18b1d193eaa7cec41007e04bf0a98453b06ec7582aa29882c52eb7b` |
| 4 | `0x78e6a2f693fd9f318cf2b3d19661a20f201375bca6c0f25d1863126976b0bb2` | `0x4d9c4a53ea15d2b447b08fb96a13c5ab7dc7d24067b102fcbaaf7b39ca52e50` |
| 5 | `0x141fee3a634c393219b6a5bbec9dda12efa13ad7303f780e185dd41fd1cc01c` | `0x463bcb1a6e570acffd4671503082fa8656e3eacb78fb1925f8a7c76400e8e79` |
| 6 | `0x7ee358b1bed689e66605aae4e7ab873f818dc953b39f115929ec00c0e575c52` | `0x219fb2d099a9458f7c10c2efbb8b101d9e0ec85610d5c74a887d1d4fb8d2898` |
| 7 | `0x410fe5c6678a9538f6ba772e84095e7c3e4082b87bec122e9208e5e754158b` | `0x5bad51eb408aebc9dd91bbbed8dbeae0a2c89e0e05f0cce87c98652a8437fd6` |
| 8 | `0x191e2636da5c2aada7c8428c81405837cf6e0962671e32183b97a8a571a8a88` | `0x6fba86ae9e0c080865f7e24e8349d4ecdbc8b0f4632842499a0dfa60568e273` |
| 9 | `0x6e411ac18fe4829fae81821142dc9dd35a037be69539756f186f9db56625185` | `0x260b8a10343bde45dacb4f1d32d06c4fdddc9981a3619fbc0a5cd9eb30f335e` |
| 10 | `0x4a2b383d808b7285cc98b2309f974f5111633c84fd82c9375c118485d2d57ba` | `0x7a9779748888c95d96bbbce041b5109c6ffc0c4f30561c0170384a5922d9e91` |

## Account Configuration Files

Account files for starkli are stored in `contracts/accounts/`:
- `dev1.json` - Dev Account #1
- `dev2.json` - Dev Account #2

## Usage in Frontend

The frontend (`apps/frontend/providers/wallet-provider.tsx`) uses these accounts for devnet mode:

```typescript
const DEVNET_ACCOUNTS = [
  {
    address: '0x3bb306a004034dba19e6cf7b161e7a4fef64bc1078419e8ad1876192f0b8cd1',
    privateKey: '0x76f2ccdb23f29bc7b69278e947c01c6160a31cf02c19d06d0f6e5ab1d768b86',
    name: 'Devnet Account #1',
  },
  {
    address: '0x5e9e93c6235f8ae6c2f4f0069bd30753ec21b26fbad80cfbf5da2c1bc573d69',
    privateKey: '0x11830d3641a682d4a690dcc25d1f4b0dac948325ac18f6dd32564371735f320',
    name: 'Devnet Account #2',
  },
];
```

## Usage with starkli

```bash
# Declare a contract
starkli declare target/dev/contract.json \
  --rpc http://localhost:9944 \
  --account contracts/accounts/dev1.json \
  --private-key 0x76f2ccdb23f29bc7b69278e947c01c6160a31cf02c19d06d0f6e5ab1d768b86

# Deploy a contract
starkli deploy <CLASS_HASH> <CONSTRUCTOR_ARGS> \
  --rpc http://localhost:9944 \
  --account contracts/accounts/dev1.json \
  --private-key 0x76f2ccdb23f29bc7b69278e947c01c6160a31cf02c19d06d0f6e5ab1d768b86
```

## Retrieving from Madara Logs

If you need to find these accounts, check the Madara container logs:

```bash
docker logs vauban-madara-l3 2>&1 | grep -A 50 "DEVNET PREDEPLOYED"
```

## Security Notes

- These keys are **FOR DEVNET ONLY**
- Never use these keys on mainnet or with real funds
- The private keys are intentionally public for development purposes
- All accounts start with 10,000 STRK and 10,000 ETH
