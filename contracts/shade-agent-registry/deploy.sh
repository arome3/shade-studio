#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Configurable environment variables
CONTRACT_NAME="${CONTRACT_NAME:-agent-registry.testnet}"
OWNER_ACCOUNT="${OWNER_ACCOUNT:-$CONTRACT_NAME}"
NETWORK="${NETWORK:-testnet}"

echo "Deploying shade-agent-registry contract"
echo "  Contract:  $CONTRACT_NAME"
echo "  Owner:     $OWNER_ACCOUNT"
echo "  Network:   $NETWORK"
echo ""

# Build first
bash build.sh

WASM_FILE="out/shade_agent_registry.wasm"
if [ ! -f "$WASM_FILE" ]; then
  echo "ERROR: WASM file not found at $WASM_FILE"
  exit 1
fi

# Check for near CLI
if ! command -v near &>/dev/null; then
  echo "ERROR: near-cli is required. Install with: npm install -g near-cli"
  exit 1
fi

# Deploy
echo "Deploying contract..."
near deploy "$CONTRACT_NAME" "$WASM_FILE" --networkId "$NETWORK"

# Initialize
echo "Initializing contract with owner: $OWNER_ACCOUNT"
near call "$CONTRACT_NAME" new "{\"owner\": \"$OWNER_ACCOUNT\"}" \
  --accountId "$OWNER_ACCOUNT" \
  --networkId "$NETWORK" \
  --gas 100000000000000 || {
  echo "Note: Initialization may have already been done (contract already initialized)."
}

echo ""
echo "Deployment complete!"
echo "Contract: $CONTRACT_NAME"
echo "Explorer: https://${NETWORK}.nearblocks.io/address/${CONTRACT_NAME}"
