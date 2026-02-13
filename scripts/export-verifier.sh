#!/usr/bin/env bash
#
# Export Solidity verifier contracts from zkey files.
# These contracts can be deployed on-chain for proof verification.
#
# Requires: snarkjs installed, trusted setup already completed.
#
# Usage: ./scripts/export-verifier.sh
# Output: build/contracts/<name>Verifier.sol

set -euo pipefail

BUILD_DIR="build/circuits"
CONTRACTS_DIR="build/contracts"
CIRCUITS=("verified-builder" "grant-track-record" "team-attestation")
SNARKJS="npx snarkjs"

echo "=== Exporting Solidity Verifiers ==="

mkdir -p "$CONTRACTS_DIR"

for circuit in "${CIRCUITS[@]}"; do
    echo "--- Exporting $circuit verifier ---"
    zkey_file="$BUILD_DIR/$circuit/$circuit.zkey"

    if [ ! -f "$zkey_file" ]; then
        echo "Error: zkey not found: $zkey_file (run trusted-setup.sh first)"
        exit 1
    fi

    # Convert circuit-name to PascalCase for Solidity contract name
    contract_name=$(echo "$circuit" | sed -r 's/(^|-)([a-z])/\U\2/g')

    $SNARKJS zkey export solidityverifier \
        "$zkey_file" \
        "$CONTRACTS_DIR/${contract_name}Verifier.sol"

    echo "  Contract: $CONTRACTS_DIR/${contract_name}Verifier.sol"
    echo ""
done

# Also copy WASM and zkey to public directory for browser access
PUBLIC_DIR="public/circuits"
echo "--- Copying artifacts to public/ for browser access ---"
mkdir -p "$PUBLIC_DIR"

for circuit in "${CIRCUITS[@]}"; do
    wasm_src="$BUILD_DIR/$circuit/${circuit}_js/$circuit.wasm"
    zkey_src="$BUILD_DIR/$circuit/$circuit.zkey"
    vkey_src="$BUILD_DIR/$circuit/$circuit.vkey.json"

    if [ -f "$wasm_src" ]; then
        cp "$wasm_src" "$PUBLIC_DIR/$circuit.wasm"
        echo "  Copied: $PUBLIC_DIR/$circuit.wasm"
    fi

    if [ -f "$zkey_src" ]; then
        cp "$zkey_src" "$PUBLIC_DIR/$circuit.zkey"
        echo "  Copied: $PUBLIC_DIR/$circuit.zkey"
    fi

    if [ -f "$vkey_src" ]; then
        cp "$vkey_src" "$PUBLIC_DIR/$circuit.vkey.json"
        echo "  Copied: $PUBLIC_DIR/$circuit.vkey.json"
    fi
done
echo ""

echo "=== Verifier export complete ==="
