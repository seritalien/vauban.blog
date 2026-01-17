#!/bin/bash
# Deploy Vauban Blog Smart Contracts to Madara L3
# Usage: ./contracts/scripts/deploy.sh [--network <rpc_url>] [--account <account_file>]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$CONTRACTS_DIR")"

# Default configuration
RPC_URL="${RPC_URL:-http://localhost:9944}"
ACCOUNT_FILE="${ACCOUNT_FILE:-$HOME/.starknet_accounts/deployer.json}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🚀 Deploying Vauban Blog Smart Contracts"
echo "=========================================="

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --network)
            RPC_URL="$2"
            shift 2
            ;;
        --account)
            ACCOUNT_FILE="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Usage: $0 [--network <rpc_url>] [--account <account_file>]"
            exit 1
            ;;
    esac
done

echo "📍 Network:  $RPC_URL"
echo "👤 Account:  $ACCOUNT_FILE"
echo ""

# Check if starkli is installed
if ! command -v starkli &> /dev/null; then
    echo -e "${RED}❌ Error: starkli is not installed${NC}"
    echo "Install with: curl https://get.starkli.sh | sh"
    exit 1
fi

# Check if contracts are compiled
if [ ! -d "$CONTRACTS_DIR/target/dev" ]; then
    echo "📦 Compiling contracts..."
    cd "$CONTRACTS_DIR"
    scarb build
fi

# Check RPC connectivity
echo "🔗 Checking RPC connectivity..."
if ! curl -s "$RPC_URL/health" > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Cannot connect to RPC at $RPC_URL${NC}"
    echo "Make sure Madara is running: ./scripts/start-devnet.sh"
    exit 1
fi
echo -e "${GREEN}✅ RPC is reachable${NC}"

# Deploy function
deploy_contract() {
    local CONTRACT_NAME=$1
    local CONSTRUCTOR_ARGS=$2
    local CONTRACT_FILE="$CONTRACTS_DIR/target/dev/vauban_blog_${CONTRACT_NAME}.contract_class.json"

    echo ""
    echo "📄 Deploying $CONTRACT_NAME..."

    if [ ! -f "$CONTRACT_FILE" ]; then
        echo -e "${RED}❌ Error: Contract file not found: $CONTRACT_FILE${NC}"
        return 1
    fi

    # Declare contract class
    echo "   Declaring class..."
    local CLASS_HASH=$(starkli declare "$CONTRACT_FILE" \
        --rpc "$RPC_URL" \
        --account "$ACCOUNT_FILE" \
        2>&1 | grep "Class hash declared:" | awk '{print $NF}' || echo "")

    if [ -z "$CLASS_HASH" ]; then
        echo -e "${YELLOW}   ⚠️  Class may already be declared, trying to deploy...${NC}"
        # Try to get class hash from file
        CLASS_HASH=$(starkli class-hash "$CONTRACT_FILE")
    else
        echo -e "${GREEN}   ✅ Class hash: $CLASS_HASH${NC}"
    fi

    # Deploy contract
    echo "   Deploying contract..."
    local DEPLOY_OUTPUT=$(starkli deploy "$CLASS_HASH" $CONSTRUCTOR_ARGS \
        --rpc "$RPC_URL" \
        --account "$ACCOUNT_FILE" \
        --watch 2>&1)

    local CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "Contract deployed:" | awk '{print $NF}' || echo "")

    if [ -z "$CONTRACT_ADDRESS" ]; then
        echo -e "${RED}   ❌ Deployment failed${NC}"
        echo "$DEPLOY_OUTPUT"
        return 1
    fi

    echo -e "${GREEN}   ✅ Deployed at: $CONTRACT_ADDRESS${NC}"
    echo "$CONTRACT_ADDRESS"
}

# Get deployer address
DEPLOYER_ADDRESS=$(starkli account address "$ACCOUNT_FILE" 2>/dev/null || echo "0x1234567890")
echo "🔑 Deployer address: $DEPLOYER_ADDRESS"
echo ""

# ============================================================================
# DEPLOY CONTRACTS
# ============================================================================

echo "1️⃣  Deploying BlogRegistry..."
BLOG_REGISTRY_ADDRESS=$(deploy_contract "BlogRegistry" "$DEPLOYER_ADDRESS $DEPLOYER_ADDRESS 250 60")
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to deploy BlogRegistry${NC}"
    exit 1
fi

echo ""
echo "2️⃣  Deploying Social..."
SOCIAL_ADDRESS=$(deploy_contract "Social" "$DEPLOYER_ADDRESS")
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to deploy Social${NC}"
    exit 1
fi

echo ""
echo "3️⃣  Deploying Paymaster..."
PAYMASTER_ADDRESS=$(deploy_contract "Paymaster" "$DEPLOYER_ADDRESS $DEPLOYER_ADDRESS 100000000000000000000 1000000000000000000")
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to deploy Paymaster${NC}"
    exit 1
fi

echo ""
echo "4️⃣  Deploying SessionKeyManager..."
SESSION_KEY_MANAGER_ADDRESS=$(deploy_contract "SessionKeyManager" "$DEPLOYER_ADDRESS")
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to deploy SessionKeyManager${NC}"
    exit 1
fi

# ============================================================================
# POST-DEPLOYMENT CONFIGURATION
# ============================================================================

echo ""
echo "⚙️  Post-deployment configuration..."

# Whitelist Social contract in Paymaster
echo "   Whitelisting Social contract in Paymaster..."
starkli invoke "$PAYMASTER_ADDRESS" whitelist_contract "$SOCIAL_ADDRESS" \
    --rpc "$RPC_URL" \
    --account "$ACCOUNT_FILE" \
    --watch > /dev/null 2>&1 || echo -e "${YELLOW}   ⚠️  Failed to whitelist${NC}"

# Fund Paymaster with initial balance
echo "   Funding Paymaster (simulated - requires ERC20 integration)..."
# starkli invoke "$PAYMASTER_ADDRESS" fund 1000000000000000000000 \
#     --rpc "$RPC_URL" \
#     --account "$ACCOUNT_FILE" \
#     --watch

echo -e "${GREEN}   ✅ Configuration complete${NC}"

# ============================================================================
# SAVE DEPLOYMENT INFO
# ============================================================================

DEPLOYMENT_FILE="$PROJECT_ROOT/.deployments.json"
cat > "$DEPLOYMENT_FILE" <<EOF
{
  "network": "$RPC_URL",
  "deployed_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "deployer": "$DEPLOYER_ADDRESS",
  "contracts": {
    "BlogRegistry": "$BLOG_REGISTRY_ADDRESS",
    "Social": "$SOCIAL_ADDRESS",
    "Paymaster": "$PAYMASTER_ADDRESS",
    "SessionKeyManager": "$SESSION_KEY_MANAGER_ADDRESS"
  }
}
EOF

echo ""
echo "💾 Deployment info saved to: $DEPLOYMENT_FILE"

# Create .env.local for frontend
FRONTEND_ENV="$PROJECT_ROOT/apps/frontend/.env.local"
mkdir -p "$(dirname "$FRONTEND_ENV")"
cat > "$FRONTEND_ENV" <<EOF
# Auto-generated by contracts/scripts/deploy.sh
# Deployed at: $(date)

NEXT_PUBLIC_MADARA_RPC=$RPC_URL
NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS=$BLOG_REGISTRY_ADDRESS
NEXT_PUBLIC_SOCIAL_ADDRESS=$SOCIAL_ADDRESS
NEXT_PUBLIC_PAYMASTER_ADDRESS=$PAYMASTER_ADDRESS
NEXT_PUBLIC_SESSION_KEY_MANAGER_ADDRESS=$SESSION_KEY_MANAGER_ADDRESS
NEXT_PUBLIC_CHAIN_ID=VAUBAN_DEV
EOF

echo "📝 Frontend .env.local updated: $FRONTEND_ENV"

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo "=========================================="
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "=========================================="
echo ""
echo "📋 Deployed Contracts:"
echo "   • BlogRegistry:       $BLOG_REGISTRY_ADDRESS"
echo "   • Social:             $SOCIAL_ADDRESS"
echo "   • Paymaster:          $PAYMASTER_ADDRESS"
echo "   • SessionKeyManager:  $SESSION_KEY_MANAGER_ADDRESS"
echo ""
echo "🔍 Verify deployment:"
echo "   starkli call $BLOG_REGISTRY_ADDRESS get_post_count --rpc $RPC_URL"
echo ""
