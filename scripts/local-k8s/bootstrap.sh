#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLUSTER_NAME="${CLUSTER_NAME:-open-analyst-local}"
NAMESPACE="${NAMESPACE:-open-analyst}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command docker
require_command kubectl
require_command kind

if ! kind get clusters | grep -qx "$CLUSTER_NAME"; then
  kind create cluster --name "$CLUSTER_NAME" --config "$ROOT_DIR/k8s/local/kind-config.yaml"
fi

kubectl config use-context "kind-$CLUSTER_NAME" >/dev/null

kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=180s

docker build -t open-analyst-webapp:local "$ROOT_DIR"
docker build -t open-analyst-runtime:local -f "$ROOT_DIR/services/langgraph-runtime/Dockerfile" "$ROOT_DIR"
docker build -t open-analyst-analyst-mcp:local "$ROOT_DIR/services/analyst-mcp"

kind load docker-image open-analyst-webapp:local --name "$CLUSTER_NAME"
kind load docker-image open-analyst-runtime:local --name "$CLUSTER_NAME"
kind load docker-image open-analyst-analyst-mcp:local --name "$CLUSTER_NAME"

kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
kubectl delete secret open-analyst-secrets -n "$NAMESPACE" --ignore-not-found
kubectl create secret generic open-analyst-secrets -n "$NAMESPACE" \
  --from-literal=DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@postgres:5432/open_analyst}" \
  --from-literal=CHECKPOINT_POSTGRES_URI="${CHECKPOINT_POSTGRES_URI:-postgresql://postgres:postgres@postgres:5432/open_analyst}" \
  --from-literal=ANALYST_MCP_POSTGRES_DSN="${ANALYST_MCP_POSTGRES_DSN:-postgresql://postgres:postgres@postgres:5432/open_analyst}" \
  --from-literal=LITELLM_API_KEY="${LITELLM_API_KEY:-local-dev}" \
  --from-literal=ANALYST_MCP_LITELLM_API_KEY="${ANALYST_MCP_LITELLM_API_KEY:-${LITELLM_API_KEY:-local-dev}}" \
  --from-literal=ANALYST_MCP_API_KEY="${ANALYST_MCP_API_KEY:-change-me}" \
  --from-literal=SESSION_SECRET="${SESSION_SECRET:-local-dev-session-secret}" \
  --from-literal=KEYCLOAK_CLIENT_SECRET="${KEYCLOAK_CLIENT_SECRET:-local-dev-client-secret}" \
  --from-literal=TAVILY_API_KEY="${TAVILY_API_KEY:-}" \
  --from-literal=ANALYST_MCP_SEMANTIC_SCHOLAR_API_KEY="${ANALYST_MCP_SEMANTIC_SCHOLAR_API_KEY:-}"

kubectl apply -k "$ROOT_DIR/k8s/overlays/local"
kubectl rollout status deployment/postgres -n "$NAMESPACE" --timeout=180s
kubectl rollout status deployment/minio -n "$NAMESPACE" --timeout=180s
kubectl rollout status deployment/keycloak -n "$NAMESPACE" --timeout=240s
kubectl rollout status deployment/runtime -n "$NAMESPACE" --timeout=240s
kubectl rollout status deployment/analyst-mcp -n "$NAMESPACE" --timeout=240s
kubectl rollout status deployment/webapp -n "$NAMESPACE" --timeout=240s

cat <<EOF
Local cluster is ready.
App URL: http://open-analyst.localtest.me
MinIO console: kubectl port-forward -n $NAMESPACE svc/minio 9001:9001
Workflow test:
  OPEN_ANALYST_BASE_URL=http://open-analyst.localtest.me pnpm local:k8s:e2e
If auth is enabled, provide a session cookie:
  OPEN_ANALYST_COOKIE='__oa_session=...' OPEN_ANALYST_BASE_URL=http://open-analyst.localtest.me pnpm local:k8s:e2e
EOF
