#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Deploy all NEAR smart contracts
#
# Usage: ./scripts/deploy-contracts.sh <network> <owner-account-id>
#   network: testnet | mainnet
#   owner-account-id: NEAR account that will own the contracts
#
# Requirements: near-cli (npm install -g near-cli)
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ] || [ $# -lt 2 ]; then
  echo "Usage: $0 <network> <owner-account-id>"
  echo ""
  echo "  network             testnet or mainnet"
  echo "  owner-account-id    NEAR account that will own the contracts"
  echo ""
  echo "Deploys all 4 NEAR contracts:"
  echo "  - zk-verifier"
  echo "  - async-ai-processor"
  echo "  - shade-agent-registry"
  echo "  - grant-registry"
  echo ""
  echo "Example:"
  echo "  $0 testnet deployer.testnet"
  exit 0
fi

NETWORK="$1"
OWNER="$2"

if [ "$NETWORK" != "testnet" ] && [ "$NETWORK" != "mainnet" ]; then
  echo "ERROR: network must be 'testnet' or 'mainnet', got '$NETWORK'"
  exit 1
fi

if [ "$NETWORK" = "mainnet" ]; then
  echo "WARNING: You are deploying to MAINNET."
  read -rp "Are you sure? (y/N) " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Aborted."
    exit 0
  fi
fi

# ---------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------

if ! command -v near &>/dev/null; then
  echo "ERROR: near-cli is required. Install with: npm install -g near-cli"
  exit 1
fi

export NEAR_ENV="$NETWORK"

# ---------------------------------------------------------------------------
# Contract definitions (bash 3.2 compatible — no associative arrays)
# dir:contract_id pairs
# ---------------------------------------------------------------------------

CONTRACT_DIRS="zk-verifier async-ai-processor shade-agent-registry grant-registry"
TOTAL=4
DEPLOYED=0
FAILED=0

get_contract_id() {
  local dir="$1"
  case "$dir" in
    zk-verifier)           echo "zk-verifier.$OWNER" ;;
    async-ai-processor)    echo "async-ai.$OWNER" ;;
    shade-agent-registry)  echo "agent-registry.$OWNER" ;;
    grant-registry)        echo "grant-registry.$OWNER" ;;
    *) echo ""; return 1 ;;
  esac
}

echo "Deploying $TOTAL contracts to $NETWORK (owner: $OWNER)"
echo "=========================================="

for dir in $CONTRACT_DIRS; do
  contract_id=$(get_contract_id "$dir")
  contract_dir="$ROOT_DIR/contracts/$dir"

  echo ""
  echo "--- $dir → $contract_id ---"

  if [ ! -d "$contract_dir" ]; then
    echo "  SKIP: directory not found at $contract_dir"
    FAILED=$((FAILED + 1))
    continue
  fi

  # Build
  echo "  Building..."
  if [ -f "$contract_dir/build.sh" ]; then
    (cd "$contract_dir" && bash build.sh) || {
      echo "  FAILED: build failed"
      FAILED=$((FAILED + 1))
      continue
    }
  else
    echo "  SKIP: no build.sh found"
    FAILED=$((FAILED + 1))
    continue
  fi

  # Find WASM
  wasm_file=$(find "$contract_dir/out" -name "*.wasm" -type f 2>/dev/null | head -1)
  if [ -z "$wasm_file" ]; then
    wasm_file=$(find "$contract_dir/target" -name "*.wasm" -type f 2>/dev/null | head -1)
  fi

  if [ -z "$wasm_file" ]; then
    echo "  FAILED: no .wasm file found after build"
    FAILED=$((FAILED + 1))
    continue
  fi

  size=$(wc -c < "$wasm_file")
  echo "  WASM: $wasm_file ($(( size / 1024 )) KB)"

  # Deploy
  echo "  Deploying to $contract_id..."
  near deploy "$contract_id" "$wasm_file" || {
    echo "  FAILED: deployment failed"
    FAILED=$((FAILED + 1))
    continue
  }

  # Initialize (graceful if already initialized)
  echo "  Initializing with owner=$OWNER..."
  near call "$contract_id" new "{\"owner\": \"$OWNER\"}" --accountId "$OWNER" 2>/dev/null || {
    echo "  Note: init skipped (contract may already be initialized)"
  }

  DEPLOYED=$((DEPLOYED + 1))
  echo "  SUCCESS: $contract_id deployed"
done

echo ""
echo "=========================================="
echo "Results: $DEPLOYED deployed, $FAILED failed (of $TOTAL total)"

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
