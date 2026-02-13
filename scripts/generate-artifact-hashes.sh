#!/usr/bin/env bash
#
# Generate SHA256 hashes for compiled circuit artifacts.
# Writes artifact-hashes.json to public/circuits/ for integrity verification.
#
# Requires: circuits already built and exported to public/circuits/
#
# Usage: ./scripts/generate-artifact-hashes.sh
# Output: public/circuits/artifact-hashes.json

set -euo pipefail

PUBLIC_DIR="public/circuits"
OUTPUT_FILE="$PUBLIC_DIR/artifact-hashes.json"
CIRCUITS=("verified-builder" "grant-track-record" "team-attestation")
EXTENSIONS=("wasm" "zkey" "vkey.json")

if [ ! -d "$PUBLIC_DIR" ]; then
    echo "Error: $PUBLIC_DIR does not exist. Run circuits:build first."
    exit 1
fi

echo "=== Generating Artifact Hashes ==="

# Start JSON object
echo "{" > "$OUTPUT_FILE"

first=true
for circuit in "${CIRCUITS[@]}"; do
    for ext in "${EXTENSIONS[@]}"; do
        artifact="$circuit.$ext"
        filepath="$PUBLIC_DIR/$artifact"

        if [ ! -f "$filepath" ]; then
            echo "Warning: $filepath not found, skipping"
            continue
        fi

        hash=$(shasum -a 256 "$filepath" | cut -d' ' -f1)

        if [ "$first" = true ]; then
            first=false
        else
            echo "," >> "$OUTPUT_FILE"
        fi

        printf '  "%s": "%s"' "$artifact" "$hash" >> "$OUTPUT_FILE"
        echo "  $artifact: $hash"
    done
done

echo "" >> "$OUTPUT_FILE"
echo "}" >> "$OUTPUT_FILE"

echo ""
echo "Hashes written to: $OUTPUT_FILE"
echo "=== Hash generation complete ==="
