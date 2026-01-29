#!/bin/bash
set -e

# Generate Sealed Secrets for Vauban Blog
# Usage: ./generate-sealed-secrets.sh [staging|production]
#
# Prerequisites:
# - kubeseal CLI installed (https://github.com/bitnami-labs/sealed-secrets)
# - kubectl configured with cluster access
# - sealed-secrets controller running in the cluster

ENVIRONMENT=${1:-staging}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$SCRIPT_DIR/../k8s/vauban-blog/$ENVIRONMENT"
OUTPUT_FILE="$K8S_DIR/01-sealed-secrets.yaml"

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo "Invalid environment. Use: staging or production"
    exit 1
fi

if ! command -v kubeseal &> /dev/null; then
    echo "kubeseal not found. Install: https://github.com/bitnami-labs/sealed-secrets#kubeseal"
    exit 1
fi

NAMESPACE="vauban-blog"
[[ "$ENVIRONMENT" == "staging" ]] && NAMESPACE="vauban-blog-staging"

echo "=== Vauban Blog Sealed Secrets Generator ==="
echo "Environment: $ENVIRONMENT"
echo "Namespace:   $NAMESPACE"
echo ""

# Generate random secrets
M2M_API_KEY=$(openssl rand -hex 32)
CRON_SECRET=$(openssl rand -hex 32)

echo "Generated M2M_API_KEY:  ${M2M_API_KEY:0:8}..."
echo "Generated CRON_SECRET:  ${CRON_SECRET:0:8}..."
echo ""

# Prompt for optional secrets
read -rp "Enter IRYS_PRIVATE_KEY (or press Enter to skip): " IRYS_PRIVATE_KEY
echo ""

# Prompt for GHCR credentials
read -rp "Enter GitHub username for GHCR: " GHCR_USER
read -rsp "Enter GitHub PAT (Personal Access Token) for GHCR: " GHCR_TOKEN
echo ""

if [[ -z "$GHCR_USER" || -z "$GHCR_TOKEN" ]]; then
    echo "Warning: GHCR credentials not provided. ghcr-secret will not be created."
fi

# Create app secrets
echo "Sealing application secrets..."
cat <<EOF | kubeseal --format yaml --namespace "$NAMESPACE" --controller-namespace sealed-secrets > /tmp/vauban-app-sealed.yaml
apiVersion: v1
kind: Secret
metadata:
  name: vauban-blog-secrets
  namespace: $NAMESPACE
type: Opaque
stringData:
  M2M_API_KEY: "$M2M_API_KEY"
  CRON_SECRET: "$CRON_SECRET"
  IRYS_PRIVATE_KEY: "${IRYS_PRIVATE_KEY:-placeholder}"
EOF

# Create GHCR pull secret
if [[ -n "$GHCR_USER" && -n "$GHCR_TOKEN" ]]; then
    echo "Sealing GHCR pull secret..."
    DOCKER_CONFIG=$(echo -n "{\"auths\":{\"ghcr.io\":{\"username\":\"$GHCR_USER\",\"password\":\"$GHCR_TOKEN\"}}}" | base64 -w0)
    cat <<EOF | kubeseal --format yaml --namespace "$NAMESPACE" --controller-namespace sealed-secrets > /tmp/vauban-ghcr-sealed.yaml
apiVersion: v1
kind: Secret
metadata:
  name: ghcr-secret
  namespace: $NAMESPACE
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: $DOCKER_CONFIG
EOF
fi

# Combine into output file
echo "---" > "$OUTPUT_FILE"
echo "# Sealed Secrets for $ENVIRONMENT" >> "$OUTPUT_FILE"
echo "# Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$OUTPUT_FILE"
echo "# Re-generate with: k8s/scripts/generate-sealed-secrets.sh $ENVIRONMENT" >> "$OUTPUT_FILE"
cat /tmp/vauban-app-sealed.yaml >> "$OUTPUT_FILE"

if [[ -f /tmp/vauban-ghcr-sealed.yaml ]]; then
    echo "---" >> "$OUTPUT_FILE"
    cat /tmp/vauban-ghcr-sealed.yaml >> "$OUTPUT_FILE"
fi

# Clean up temp files
rm -f /tmp/vauban-app-sealed.yaml /tmp/vauban-ghcr-sealed.yaml

echo ""
echo "Sealed secrets written to: $OUTPUT_FILE"
echo "Apply with: kubectl apply -f $OUTPUT_FILE"
echo ""
echo "Store the raw values securely:"
echo "  M2M_API_KEY:  $M2M_API_KEY"
echo "  CRON_SECRET:  $CRON_SECRET"
