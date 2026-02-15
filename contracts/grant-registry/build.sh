#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

human_size() {
  local bytes=$1
  if [ "$bytes" -ge 1048576 ]; then
    echo "$(echo "scale=2; $bytes / 1048576" | bc) MB"
  elif [ "$bytes" -ge 1024 ]; then
    echo "$(echo "scale=2; $bytes / 1024" | bc) KB"
  else
    echo "${bytes} bytes"
  fi
}

# ---------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------

if ! command -v rustup &>/dev/null; then
  echo "ERROR: rustup is required. Install from https://rustup.rs"
  exit 1
fi

if ! rustup target list --installed | grep -q wasm32-unknown-unknown; then
  echo "Adding wasm32-unknown-unknown target..."
  rustup target add wasm32-unknown-unknown
fi

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

echo "Building grant-registry contract..."

if command -v cargo-near &>/dev/null; then
  echo "Using cargo-near for build..."
  cargo near build non-reproducible-wasm 2>/dev/null || {
    echo "cargo-near failed, falling back to cargo build..."
    RUSTFLAGS='-C link-arg=-s' cargo build --target wasm32-unknown-unknown --release
  }
else
  echo "cargo-near not found, using cargo build..."
  RUSTFLAGS='-C link-arg=-s' cargo build --target wasm32-unknown-unknown --release
fi

# ---------------------------------------------------------------------------
# Copy WASM to output directory
# ---------------------------------------------------------------------------

mkdir -p out
WASM_SRC="target/wasm32-unknown-unknown/release/grant_registry.wasm"

if [ -f "$WASM_SRC" ]; then
  cp "$WASM_SRC" out/grant_registry.wasm
elif [ -n "$(find target -name 'grant_registry.wasm' -type f 2>/dev/null | head -1)" ]; then
  NEAR_WASM=$(find target -name "grant_registry.wasm" -type f 2>/dev/null | head -1)
  cp "$NEAR_WASM" out/grant_registry.wasm
else
  echo "ERROR: Could not find compiled WASM file"
  exit 1
fi

# ---------------------------------------------------------------------------
# wasm-opt optimization (if available)
# ---------------------------------------------------------------------------

if command -v wasm-opt &>/dev/null; then
  echo "Optimizing with wasm-opt -Oz..."
  BEFORE=$(wc -c < out/grant_registry.wasm)
  wasm-opt -Oz out/grant_registry.wasm -o out/grant_registry.wasm
  AFTER=$(wc -c < out/grant_registry.wasm)
  echo "  Before: $(human_size "$BEFORE") → After: $(human_size "$AFTER")"
else
  echo "Note: wasm-opt not found — skipping optimization. Install binaryen for smaller output."
fi

# ---------------------------------------------------------------------------
# Size reporting
# ---------------------------------------------------------------------------

SIZE=$(wc -c < out/grant_registry.wasm)
HUMAN=$(human_size "$SIZE")

echo ""
echo "Build successful: out/grant_registry.wasm ($HUMAN)"

if [ "$SIZE" -gt 4194304 ]; then
  echo "ERROR: WASM exceeds 4 MB ($HUMAN). This will likely fail to deploy."
  exit 1
elif [ "$SIZE" -gt 2097152 ]; then
  echo "WARNING: WASM exceeds 2 MB ($HUMAN). Consider reducing binary size."
elif [ "$SIZE" -gt 1048576 ]; then
  echo "INFO: WASM exceeds 1 MB ($HUMAN). Monitor size as features are added."
fi

# ---------------------------------------------------------------------------
# Run tests
# ---------------------------------------------------------------------------

echo ""
echo "Running cargo test --release..."
cargo test --release 2>&1 | tail -5

echo ""
echo "Done."
