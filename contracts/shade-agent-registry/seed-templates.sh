#!/usr/bin/env bash
set -euo pipefail

# Seeds the registry with starter agent templates.
# Run after deploy.sh has initialized the contract.

CONTRACT_NAME="${CONTRACT_NAME:-agent-registry.testnet}"
OWNER_ACCOUNT="${OWNER_ACCOUNT:-$CONTRACT_NAME}"
NETWORK="${NETWORK:-testnet}"
GAS="50000000000000"

echo "Seeding agent templates on $CONTRACT_NAME ($NETWORK)"
echo ""

# ---------------------------------------------------------------------------
# Template 1: Grant Analysis Agent
# ---------------------------------------------------------------------------

echo "Registering: Grant Analysis Agent (tmpl-analysis-v1)..."
near call "$CONTRACT_NAME" register_template '{
  "id": "tmpl-analysis-v1",
  "name": "Grant Analysis Agent",
  "description": "Analyzes grant proposals for completeness, feasibility, and alignment with funding objectives",
  "version": "1.0.0",
  "codehash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "source_url": "https://github.com/shade-studio/agent-templates/tree/main/analysis-v1",
  "audit_url": null,
  "capabilities": ["ai-analysis", "read-documents"],
  "required_permissions": [{
    "receiver_id": "v1.social08.testnet",
    "method_names": ["get"],
    "allowance": "250000000000000000000000",
    "purpose": "Read document data from social contract"
  }]
}' --accountId "$OWNER_ACCOUNT" --networkId "$NETWORK" --gas "$GAS"

echo ""

# ---------------------------------------------------------------------------
# Template 2: Document Summarizer Agent
# ---------------------------------------------------------------------------

echo "Registering: Document Summarizer Agent (tmpl-summarizer-v1)..."
near call "$CONTRACT_NAME" register_template '{
  "id": "tmpl-summarizer-v1",
  "name": "Document Summarizer Agent",
  "description": "Generates concise summaries of project documents and proposals",
  "version": "1.0.0",
  "codehash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "source_url": "https://github.com/shade-studio/agent-templates/tree/main/summarizer-v1",
  "audit_url": null,
  "capabilities": ["ai-chat", "read-documents"],
  "required_permissions": [{
    "receiver_id": "v1.social08.testnet",
    "method_names": ["get"],
    "allowance": "250000000000000000000000",
    "purpose": "Read document data from social contract"
  }]
}' --accountId "$OWNER_ACCOUNT" --networkId "$NETWORK" --gas "$GAS"

echo ""

# ---------------------------------------------------------------------------
# Template 3: Blockchain Monitor Agent
# ---------------------------------------------------------------------------

echo "Registering: Blockchain Monitor Agent (tmpl-monitor-v1)..."
near call "$CONTRACT_NAME" register_template '{
  "id": "tmpl-monitor-v1",
  "name": "Blockchain Monitor Agent",
  "description": "Monitors on-chain activity and generates alerts for significant events",
  "version": "1.0.0",
  "codehash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "source_url": "https://github.com/shade-studio/agent-templates/tree/main/monitor-v1",
  "audit_url": null,
  "capabilities": ["ai-analysis", "blockchain-read", "social-read"],
  "required_permissions": [{
    "receiver_id": "v1.social08.testnet",
    "method_names": ["get"],
    "allowance": "250000000000000000000000",
    "purpose": "Read social contract data"
  }]
}' --accountId "$OWNER_ACCOUNT" --networkId "$NETWORK" --gas "$GAS"

echo ""
echo "Seeding complete! Registered 3 templates."
