#!/usr/bin/env bash
#
# Groth16 trusted setup for compiled circuits.
# Downloads Powers of Tau (Phase 1) and runs circuit-specific Phase 2.
#
# Requires: snarkjs installed (npm dependency), circuits already compiled.
#
# Usage: ./scripts/trusted-setup.sh
# Output: build/circuits/<name>/<name>.zkey, <name>.vkey.json

set -euo pipefail

BUILD_DIR="build/circuits"
PTAU_DIR="build/ptau"
PTAU_FILE="$PTAU_DIR/powersOfTau28_hez_final_21.ptau"
CIRCUITS=("verified-builder" "grant-track-record" "team-attestation")
SNARKJS="node --max-old-space-size=8192 node_modules/.bin/snarkjs"

# Powers of Tau — 2^21 supports up to ~2M constraints (needed for verified-builder's ~1.87M)
PTAU_URL="https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_21.ptau"

echo "=== Groth16 Trusted Setup ==="

# Download Powers of Tau if not cached
mkdir -p "$PTAU_DIR"
if [ ! -f "$PTAU_FILE" ]; then
    echo "Downloading Powers of Tau (Phase 1)..."
    curl -L -o "$PTAU_FILE" "$PTAU_URL"
    echo "Downloaded: $PTAU_FILE"
else
    echo "Using cached Powers of Tau: $PTAU_FILE"
fi
echo ""

for circuit in "${CIRCUITS[@]}"; do
    echo "--- Setup for $circuit ---"
    circuit_dir="$BUILD_DIR/$circuit"
    r1cs_file="$circuit_dir/$circuit.r1cs"

    if [ ! -f "$r1cs_file" ]; then
        echo "Error: R1CS not found: $r1cs_file (run compile-circuits.sh first)"
        exit 1
    fi

    # Phase 2: Circuit-specific setup
    echo "  Running Groth16 setup (Phase 2)..."
    $SNARKJS groth16 setup \
        "$r1cs_file" \
        "$PTAU_FILE" \
        "$circuit_dir/${circuit}_0000.zkey"

    # Contribute randomness (non-interactive for dev; use ceremony for production)
    echo "  Contributing randomness..."
    $SNARKJS zkey contribute \
        "$circuit_dir/${circuit}_0000.zkey" \
        "$circuit_dir/$circuit.zkey" \
        --name="Shade Studio Dev Setup" \
        -v -e="$(head -c 64 /dev/urandom | xxd -p)"

    # Clean up intermediate zkey
    rm -f "$circuit_dir/${circuit}_0000.zkey"

    # Export verification key
    echo "  Exporting verification key..."
    $SNARKJS zkey export verificationkey \
        "$circuit_dir/$circuit.zkey" \
        "$circuit_dir/$circuit.vkey.json"

    echo "  zkey: $circuit_dir/$circuit.zkey"
    echo "  vkey: $circuit_dir/$circuit.vkey.json"
    echo ""
done

echo "=== Trusted setup complete ==="
