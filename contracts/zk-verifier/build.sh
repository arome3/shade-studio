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

echo "Building zk-verifier contract..."

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
WASM_SRC="target/wasm32-unknown-unknown/release/zk_verifier.wasm"

if [ -f "$WASM_SRC" ]; then
  cp "$WASM_SRC" out/zk_verifier.wasm
elif [ -n "$(find target -name 'zk_verifier.wasm' -type f 2>/dev/null | head -1)" ]; then
  NEAR_WASM=$(find target -name "zk_verifier.wasm" -type f 2>/dev/null | head -1)
  cp "$NEAR_WASM" out/zk_verifier.wasm
else
  echo "ERROR: Could not find compiled WASM file"
  exit 1
fi

# ---------------------------------------------------------------------------
# NEAR VM compatibility: strip reference-types via WAT roundtrip
# Rust 1.82+ emits reference-types WASM features that NEAR VM doesn't support.
# Converting WASM → WAT → WASM re-encodes call_indirect in legacy format.
# ---------------------------------------------------------------------------

if command -v wasm2wat &>/dev/null && command -v wat2wasm &>/dev/null; then
  echo "Stripping reference-types via WAT roundtrip..."
  BEFORE=$(wc -c < out/zk_verifier.wasm)
  wasm2wat out/zk_verifier.wasm -o out/zk_verifier.wat
  wat2wasm out/zk_verifier.wat -o out/zk_verifier.wasm
  rm -f out/zk_verifier.wat
  AFTER=$(wc -c < out/zk_verifier.wasm)
  echo "  Before: $(human_size "$BEFORE") → After: $(human_size "$AFTER")"
else
  echo "WARNING: wabt (wasm2wat/wat2wasm) not found — WASM may not be NEAR VM compatible."
  echo "  Install with: brew install wabt"
fi

# ---------------------------------------------------------------------------
# wasm-opt optimization (if available)
# ---------------------------------------------------------------------------

if command -v wasm-opt &>/dev/null; then
  echo "Optimizing with wasm-opt -Oz..."
  BEFORE=$(wc -c < out/zk_verifier.wasm)
  wasm-opt -Oz out/zk_verifier.wasm -o out/zk_verifier.wasm
  AFTER=$(wc -c < out/zk_verifier.wasm)
  echo "  Before: $(human_size "$BEFORE") → After: $(human_size "$AFTER")"
else
  echo "Note: wasm-opt not found — skipping optimization. Install binaryen for smaller output."
fi

# ---------------------------------------------------------------------------
# Size reporting with tiered warnings
# ---------------------------------------------------------------------------

SIZE=$(wc -c < out/zk_verifier.wasm)
HUMAN=$(human_size "$SIZE")

echo ""
echo "Build successful: out/zk_verifier.wasm ($HUMAN)"

if [ "$SIZE" -gt 4194304 ]; then
  echo "ERROR: WASM exceeds 4 MB ($HUMAN). This will likely fail to deploy. Reduce dependencies."
  exit 1
elif [ "$SIZE" -gt 2097152 ]; then
  echo "WARNING: WASM exceeds 2 MB ($HUMAN). Consider reducing binary size."
elif [ "$SIZE" -gt 1048576 ]; then
  echo "INFO: WASM exceeds 1 MB ($HUMAN). Monitor size as features are added."
fi

# ---------------------------------------------------------------------------
# Run tests as a proxy for gas behavior
# ---------------------------------------------------------------------------

echo ""
echo "Running cargo test --release..."
TEST_START=$(date +%s%N 2>/dev/null || echo "0")
cargo test --release 2>&1 | tail -5
TEST_END=$(date +%s%N 2>/dev/null || echo "0")

if [ "$TEST_START" != "0" ] && [ "$TEST_END" != "0" ]; then
  ELAPSED=$(( (TEST_END - TEST_START) / 1000000 ))
  echo "Tests completed in ${ELAPSED}ms"
fi

echo ""
echo "Done."
