#!/bin/bash
set -e

# Update contract addresses in K8s configmaps from .deployments.json
# Usage: ./update-contract-addresses.sh [staging|production]
#
# Reads .deployments.json at the project root and patches the
# 02-configmaps.yaml with actual deployed contract addresses.

ENVIRONMENT=${1:-staging}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/../.."
DEPLOYMENTS_FILE="$PROJECT_ROOT/.deployments.json"
CONFIGMAP_FILE="$SCRIPT_DIR/../k8s/vauban-blog/$ENVIRONMENT/02-configmaps.yaml"

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo "Invalid environment. Use: staging or production"
    exit 1
fi

if [[ ! -f "$DEPLOYMENTS_FILE" ]]; then
    echo "Error: $DEPLOYMENTS_FILE not found"
    echo "Run 'pnpm contracts:deploy' first to generate deployment addresses."
    exit 1
fi

if [[ ! -f "$CONFIGMAP_FILE" ]]; then
    echo "Error: $CONFIGMAP_FILE not found"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "Error: jq is required. Install with: sudo apt install jq"
    exit 1
fi

echo "=== Updating Contract Addresses ==="
echo "Source:      $DEPLOYMENTS_FILE"
echo "Target:      $CONFIGMAP_FILE"
echo "Environment: $ENVIRONMENT"
echo ""

# Read addresses from .deployments.json
BLOG_REGISTRY=$(jq -r '.contracts.BlogRegistry.address // empty' "$DEPLOYMENTS_FILE")
SOCIAL=$(jq -r '.contracts.Social.address // empty' "$DEPLOYMENTS_FILE")
ROLE_REGISTRY=$(jq -r '.contracts.RoleRegistry.address // empty' "$DEPLOYMENTS_FILE")
REPUTATION=$(jq -r '.contracts.Reputation.address // empty' "$DEPLOYMENTS_FILE")
FOLLOWS=$(jq -r '.contracts.Follows.address // empty' "$DEPLOYMENTS_FILE")
TREASURY=$(jq -r '.contracts.Treasury.address // empty' "$DEPLOYMENTS_FILE")
PAYMASTER=$(jq -r '.contracts.Paymaster.address // empty' "$DEPLOYMENTS_FILE")
SESSION_KEY_MANAGER=$(jq -r '.contracts.SessionKeyManager.address // empty' "$DEPLOYMENTS_FILE")

echo "Addresses found:"
echo "  BlogRegistry:     ${BLOG_REGISTRY:-<not deployed>}"
echo "  Social:           ${SOCIAL:-<not deployed>}"
echo "  RoleRegistry:     ${ROLE_REGISTRY:-<not deployed>}"
echo "  Reputation:       ${REPUTATION:-<not deployed>}"
echo "  Follows:          ${FOLLOWS:-<not deployed>}"
echo "  Treasury:         ${TREASURY:-<not deployed>}"
echo "  Paymaster:        ${PAYMASTER:-<not deployed>}"
echo "  SessionKeyManager:${SESSION_KEY_MANAGER:-<not deployed>}"
echo ""

# Update configmap using sed
update_address() {
    local key="$1"
    local value="$2"
    if [[ -n "$value" ]]; then
        sed -i "s|${key}: \".*\"|${key}: \"${value}\"|" "$CONFIGMAP_FILE"
        echo "  Updated $key"
    else
        echo "  Skipped $key (not deployed)"
    fi
}

update_address "NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS" "$BLOG_REGISTRY"
update_address "NEXT_PUBLIC_SOCIAL_ADDRESS" "$SOCIAL"
update_address "NEXT_PUBLIC_ROLE_REGISTRY_ADDRESS" "$ROLE_REGISTRY"
update_address "NEXT_PUBLIC_REPUTATION_ADDRESS" "$REPUTATION"
update_address "NEXT_PUBLIC_FOLLOWS_ADDRESS" "$FOLLOWS"
update_address "NEXT_PUBLIC_TREASURY_ADDRESS" "$TREASURY"
update_address "NEXT_PUBLIC_PAYMASTER_ADDRESS" "$PAYMASTER"
update_address "NEXT_PUBLIC_SESSION_KEY_MANAGER_ADDRESS" "$SESSION_KEY_MANAGER"

echo ""
echo "Done. Review changes with: git diff $CONFIGMAP_FILE"
