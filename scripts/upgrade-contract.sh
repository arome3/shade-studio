#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Upgrade a single NEAR smart contract (deploy without re-initialization)
#
# Usage: ./scripts/upgrade-contract.sh <network> <contract-dir> <contract-id>
#   network:       testnet | mainnet
#   contract-dir:  Directory name under contracts/ (e.g. zk-verifier)
#   contract-id:   Deployed contract account (e.g. zk-verifier.testnet)
#
# Requirements: near-cli (npm install -g near-cli)
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ] || [ $# -lt 3 ]; then
  echo "Usage: $0 <network> <contract-dir> <contract-id>"
  echo ""
  echo "  network        testnet or mainnet"
  echo "  contract-dir   Directory name under contracts/"
  echo "  contract-id    Deployed contract account ID"
  echo ""
  echo "Example:"
  echo "  $0 testnet zk-verifier zk-verifier.testnet"
  exit 0
fi

NETWORK="$1"
CONTRACT_DIR_NAME="$2"
CONTRACT_ID="$3"
CONTRACT_DIR="$ROOT_DIR/contracts/$CONTRACT_DIR_NAME"

if [ "$NETWORK" != "testnet" ] && [ "$NETWORK" != "mainnet" ]; then
  echo "ERROR: network must be 'testnet' or 'mainnet', got '$NETWORK'"
  exit 1
fi

if [ ! -d "$CONTRACT_DIR" ]; then
  echo "ERROR: contract directory not found: $CONTRACT_DIR"
  exit 1
fi

if [ "$NETWORK" = "mainnet" ]; then
  echo "WARNING: You are upgrading $CONTRACT_ID on MAINNET."
  echo "This will replace the contract code without re-initialization."
  read -rp "Are you sure? (y/N) " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Aborted."
    exit 0
  fi
fi

export NEAR_ENV="$NETWORK"

# Build
echo "Building $CONTRACT_DIR_NAME..."
(cd "$CONTRACT_DIR" && bash build.sh)

# Find WASM
wasm_file=$(find "$CONTRACT_DIR/out" -name "*.wasm" -type f 2>/dev/null | head -1)
if [ -z "$wasm_file" ]; then
  wasm_file=$(find "$CONTRACT_DIR/target" -name "*.wasm" -type f 2>/dev/null | head -1)
fi

if [ -z "$wasm_file" ]; then
  echo "ERROR: no .wasm file found after build"
  exit 1
fi

size=$(wc -c < "$wasm_file")
echo "WASM: $wasm_file ($(( size / 1024 )) KB)"

# Deploy (no init call)
echo "Deploying to $CONTRACT_ID on $NETWORK..."
near deploy "$CONTRACT_ID" "$wasm_file"

echo ""
echo "Upgrade complete: $CONTRACT_ID"
echo "Verify with: near view $CONTRACT_ID get_status '{}'"
