#!/usr/bin/env bash
# Emit lane_sync JSON for deploy-meta.json (requires fetch-depth: 0 checkout).
set -euo pipefail
git fetch origin main dev 2>/dev/null || git fetch origin main 2>/dev/null || true
BRANCH="${GITHUB_REF_NAME:-$(git rev-parse --abbrev-ref HEAD)}"
LIVE_SHA="$(git rev-parse origin/main 2>/dev/null || git rev-parse HEAD)"
LIVE_SHORT="$(echo "$LIVE_SHA" | cut -c1-12)"
if [ "$BRANCH" = "main" ]; then
  AHEAD=0
  BEHIND=0
else
  AHEAD="$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)"
  BEHIND="$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)"
fi
ALIGNED=false
if [ "$AHEAD" = "0" ] && [ "$BEHIND" = "0" ]; then
  ALIGNED=true
fi
PROMOTE=false
if [ "$BRANCH" = "dev" ] && [ "$BEHIND" = "0" ] && [ "$AHEAD" -gt 0 ]; then
  PROMOTE=true
fi
cat <<EOF
    "lane_sync": {
      "live_branch": "main",
      "dev_branch": "dev",
      "built_branch": "$BRANCH",
      "live_sha_short": "$LIVE_SHORT",
      "dev_commits_ahead_of_live": $AHEAD,
      "dev_commits_behind_live": $BEHIND,
      "branches_aligned": $ALIGNED,
      "promote_ready": $PROMOTE
    },
EOF
