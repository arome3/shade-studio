#!/usr/bin/env bash
#
# Compile Circom circuits to R1CS + WASM + SYM artifacts.
# Requires: circom 2.1.0+ installed globally.
#
# Usage: ./scripts/compile-circuits.sh
# Output: build/circuits/<name>/ containing .r1cs, .wasm, .sym

set -euo pipefail

CIRCUITS_DIR="src/circuits"
BUILD_DIR="build/circuits"
CIRCUITS=("verified-builder" "grant-track-record" "team-attestation")

# Check circom is installed
if ! command -v circom &> /dev/null; then
    echo "Error: circom is not installed. Install from https://docs.circom.io/getting-started/installation/"
    exit 1
fi

# Verify circom version >= 2.1.0 (required by pragma in circuits)
CIRCOM_VERSION=$(circom --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
REQUIRED="2.1.0"
if [ "$(printf '%s\n' "$REQUIRED" "$CIRCOM_VERSION" | sort -V | head -1)" != "$REQUIRED" ]; then
    echo "Error: circom $REQUIRED+ required (found $CIRCOM_VERSION)"
    echo "Upgrade: cargo install --git https://github.com/iden3/circom.git --tag v2.1.9"
    exit 1
fi

echo "=== Compiling Circom Circuits ==="
echo "circom version: $(circom --version)"
echo ""

mkdir -p "$BUILD_DIR"

for circuit in "${CIRCUITS[@]}"; do
    echo "--- Compiling $circuit ---"
    circuit_file="$CIRCUITS_DIR/$circuit.circom"

    if [ ! -f "$circuit_file" ]; then
        echo "Error: Circuit file not found: $circuit_file"
        exit 1
    fi

    output_dir="$BUILD_DIR/$circuit"
    mkdir -p "$output_dir"

    circom "$circuit_file" \
        --r1cs \
        --wasm \
        --sym \
        --output "$output_dir" \
        -l node_modules \
        -l .

    echo "  R1CS: $output_dir/$circuit.r1cs"
    echo "  WASM: $output_dir/${circuit}_js/${circuit}.wasm"
    echo "  SYM:  $output_dir/$circuit.sym"
    echo "  Constraints: $(grep -c "^" "$output_dir/$circuit.sym" 2>/dev/null || echo "N/A")"
    echo ""
done

echo "=== All circuits compiled successfully ==="
