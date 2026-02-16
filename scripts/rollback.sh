#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Vercel deployment rollback helper
#
# Usage: ./scripts/rollback.sh [deployment-url]
#   If deployment-url is provided, promotes that deployment to production.
#   Otherwise, lists recent deployments for selection.
#
# Requirements: vercel CLI (npm install -g vercel)
# ---------------------------------------------------------------------------

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  echo "Usage: $0 [deployment-url]"
  echo ""
  echo "  deployment-url   (optional) Vercel deployment URL to rollback to"
  echo ""
  echo "If no URL is provided, lists recent deployments."
  echo ""
  echo "Post-rollback verification:"
  echo "  1. curl https://your-app.vercel.app/api/health | jq ."
  echo "  2. Check Sentry for new errors"
  echo "  3. Verify critical user flows"
  exit 0
fi

if ! command -v vercel &>/dev/null; then
  echo "ERROR: vercel CLI is required. Install with: npm install -g vercel"
  exit 1
fi

if [ $# -ge 1 ]; then
  DEPLOYMENT_URL="$1"
  echo "Rolling back to: $DEPLOYMENT_URL"
  vercel promote "$DEPLOYMENT_URL"
  echo ""
  echo "Rollback complete."
  echo ""
  echo "Post-rollback checklist:"
  echo "  1. Verify health: curl $DEPLOYMENT_URL/api/health | jq ."
  echo "  2. Check Sentry dashboard for new errors"
  echo "  3. Test critical user flows (wallet connect, document creation)"
else
  echo "Recent deployments:"
  echo ""
  vercel ls --limit 10
  echo ""
  echo "To rollback, run:"
  echo "  $0 <deployment-url>"
fi
