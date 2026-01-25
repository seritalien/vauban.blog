#!/bin/bash
# Deploy contracts using sncast (Starknet Foundry)

set -e

cd "$(dirname "$0")/.."

RPC_URL="http://localhost:9944"
DEPLOYER_KEY="0x76f2ccdb23f29bc7b69278e947c01c6160a31cf02c19d06d0f6e5ab1d768b86"
DEPLOYER_ADDR="0x3bb306a004034dba19e6cf7b161e7a4fef64bc1078419e8ad1876192f0b8cd1"

echo "🚀 Deploying with sncast..."
echo "RPC: $RPC_URL"
echo "Deployer: $DEPLOYER_ADDR"
echo ""

# Deploy BlogRegistry
echo "1️⃣ Deploying BlogRegistry..."
BLOG_REGISTRY=$(sncast \
  --url "$RPC_URL" \
  --account dev1 \
  --accounts-file <(echo "{\"dev1\":{\"private_key\":\"$DEPLOYER_KEY\",\"public_key\":\"$DEPLOYER_KEY\",\"address\":\"$DEPLOYER_ADDR\",\"deployed\":true,\"class_hash\":\"0x061dac032f228abef9c6626f995015233097ae253a7f72d68552db02f2971b8f\",\"salt\":\"0x0\"}}") \
  deploy \
  --class-hash 0x00da988a7b90f747445fe81a9d3ea92d565c8f192c9fde974ed092f67ed6f0ea \
  --constructor-calldata $DEPLOYER_ADDR $DEPLOYER_ADDR 0xfa 0x0 \
  2>&1 | grep "contract_address" | awk '{print $2}' | tr -d '"')

echo "✅ BlogRegistry: $BLOG_REGISTRY"

# Update .env.local
cd ../..
cat > apps/frontend/.env.local << EOF
# Auto-generated
NEXT_PUBLIC_MADARA_RPC=$RPC_URL
NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS=$BLOG_REGISTRY
NEXT_PUBLIC_SOCIAL_ADDRESS=0x23c2f8bef67523a6a086f46a6d6691d06d928eaa3e1c7749fd32f4200285dfb
NEXT_PUBLIC_PAYMASTER_ADDRESS=0x1f086993216d757c7a12d7956abd24a44e271ea802227a7a46e5dd212a33df8
NEXT_PUBLIC_SESSION_KEY_MANAGER_ADDRESS=0x3887985461113c097ed9f96e7688eff2dc9a30d744f03e057538eae6366ea81
NEXT_PUBLIC_CHAIN_ID=MADARA_DEVNET

# IPFS Configuration
NEXT_PUBLIC_IPFS_GATEWAY_URL=http://localhost:8005
NEXT_PUBLIC_IPFS_API_URL=http://localhost:5001

# Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3005

# LocalAI Configuration
NEXT_PUBLIC_AI_API_URL=http://localhost:8081/v1

# M2M Publishing Configuration
M2M_API_KEY=vb_fBHlrmkSyapuX0n86jH9W3pocopvB8uh

# Relayer Account (signs blockchain transactions for M2M)
RELAYER_PRIVATE_KEY=0x76f2ccdb23f29bc7b69278e947c01c6160a31cf02c19d06d0f6e5ab1d768b86
RELAYER_ADDRESS=0x3bb306a004034dba19e6cf7b161e7a4fef64bc1078419e8ad1876192f0b8cd1
MADARA_RPC_URL=http://localhost:9944

NEXT_PUBLIC_ROLE_REGISTRY_ADDRESS=0x3a864c75941e678c2a685a2efcd89bc68c7951546ccfdb44504b5f0a6f48ced
NEXT_PUBLIC_REPUTATION_ADDRESS=0xef558283180a5c0f3b8daf79edd5592136404d0a8af7a058615428d8da887e
NEXT_PUBLIC_TREASURY_ADDRESS=0x1944f5af48af7b9c64344da7bdcd28c6cc5ac7bef6be6c9a7b20de84a2e3ec5
NEXT_PUBLIC_GEMINI_API_KEY=AIzaSyA1O4NNvjbrpVVdXULeSrDQ4f5NDrYPIUw

# Together AI - Image generation (FLUX - FAST & RELIABLE) - PRIMARY
NEXT_PUBLIC_TOGETHER_API_KEY=

# Pollinations API Key (for image generation - BACKUP)
NEXT_PUBLIC_POLLINATIONS_API_KEY=

# Hugging Face - Image generation (API deprecated, use for text only)
NEXT_PUBLIC_HUGGINGFACE_API_KEY=

# OpenRouter - 18+ free models (commercial use allowed) - TEXT ONLY
NEXT_PUBLIC_OPENROUTER_API_KEY=
EOF

echo "✅ .env.local updated"
echo "Done!"
