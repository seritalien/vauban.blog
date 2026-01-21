#!/bin/bash
set -e

# Vauban Blog k3s Deployment Script
# Usage: ./deploy.sh [staging|production]

ENVIRONMENT=${1:-staging}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Deploying Vauban Blog to $ENVIRONMENT..."

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo "❌ Invalid environment. Use: staging or production"
    exit 1
fi

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl first."
    exit 1
fi

# Check if kustomize is available (or use kubectl kustomize)
if command -v kustomize &> /dev/null; then
    KUSTOMIZE="kustomize"
else
    KUSTOMIZE="kubectl kustomize"
fi

# Build and apply
echo "📦 Building manifests with Kustomize..."
$KUSTOMIZE build "$SCRIPT_DIR/overlays/$ENVIRONMENT" > /tmp/vauban-manifests.yaml

echo "📋 Manifests to be applied:"
cat /tmp/vauban-manifests.yaml | grep "^kind:" | sort | uniq -c

# Confirm deployment
read -p "Continue with deployment? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled."
    exit 1
fi

# Apply manifests
echo "🔧 Applying manifests..."
kubectl apply -f /tmp/vauban-manifests.yaml

# Wait for deployments
echo "⏳ Waiting for deployments to be ready..."
NAMESPACE="vauban"
[[ "$ENVIRONMENT" == "staging" ]] && NAMESPACE="vauban-staging"

kubectl rollout status deployment/frontend -n $NAMESPACE --timeout=300s
kubectl rollout status deployment/redis -n $NAMESPACE --timeout=120s
kubectl rollout status deployment/ipfs -n $NAMESPACE --timeout=120s

echo "✅ Deployment complete!"
echo ""
echo "📊 Pod status:"
kubectl get pods -n $NAMESPACE

echo ""
echo "🌐 Services:"
kubectl get svc -n $NAMESPACE

echo ""
echo "🔗 Ingress:"
kubectl get ingress -n $NAMESPACE
