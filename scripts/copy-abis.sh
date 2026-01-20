#!/bin/bash
# Copy compiled contract ABIs to web3-utils package
# Run after: pnpm contracts:build

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONTRACTS_DIR="$PROJECT_ROOT/contracts/target/dev"
ABIS_DIR="$PROJECT_ROOT/packages/web3-utils/src/abis"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🔄 Copying contract ABIs..."
echo ""

# Check if contracts are compiled
if [ ! -d "$CONTRACTS_DIR" ]; then
    echo -e "${RED}❌ Error: Contracts not compiled${NC}"
    echo "Run: pnpm contracts:build"
    exit 1
fi

# Create ABIs directory if it doesn't exist
mkdir -p "$ABIS_DIR"

# Copy ABIs
declare -a contracts=("BlogRegistry" "Social" "Paymaster" "SessionKeyManager")

for contract in "${contracts[@]}"; do
    SOURCE_FILE="$CONTRACTS_DIR/vauban_blog_${contract}.contract_class.json"
    DEST_FILE="$ABIS_DIR/${contract,,}.json"  # Lowercase filename

    if [ -f "$SOURCE_FILE" ]; then
        cp "$SOURCE_FILE" "$DEST_FILE"
        echo -e "${GREEN}✓${NC} $contract ABI copied"
    else
        echo -e "${YELLOW}⚠${NC}  $contract ABI not found (skipped)"
    fi
done

echo ""
echo -e "${GREEN}✅ ABIs copied successfully!${NC}"
echo ""
echo "📋 Copied files:"
ls -lh "$ABIS_DIR"/*.json 2>/dev/null || echo "No JSON files found"
