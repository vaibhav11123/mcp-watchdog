#!/usr/bin/env bash
# Maintainer: ship MCP Watchdog 0.2.x to Marketplace + Open VSX + GitHub Releases.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version")
TAG="v${VERSION}"

echo "==> test + package ${TAG}"
npm test
npx vsce package -o "mcp-watchdog-${VERSION}.vsix"
npx vsce ls | grep -E 'test/|local\.md|launch/' && { echo "VSIX contains forbidden paths"; exit 1; } || true

if [[ -z "${VSCE_PAT:-}" ]]; then
  echo "WARN: VSCE_PAT not set — skip Marketplace publish"
else
  npx vsce publish -p "$VSCE_PAT"
fi

if [[ -z "${OVSX_PAT:-}" ]]; then
  echo "WARN: OVSX_PAT not set — skip Open VSX publish"
else
  npx ovsx publish "mcp-watchdog-${VERSION}.vsix" -p "$OVSX_PAT"
fi

echo "==> tag ${TAG} (if not exists) and push to trigger release.yml"
git tag -a "$TAG" -m "Release ${TAG}" 2>/dev/null || echo "tag ${TAG} already exists"
git push origin main
git push origin "$TAG"

echo "Done. Verify:"
echo "  https://open-vsx.org/extension/mcp-watchdog/mcp-watchdog"
echo "  https://marketplace.visualstudio.com/items?itemName=mcp-watchdog.mcp-watchdog"
echo "  https://github.com/vaibhav11123/mcp-watchdog/releases/tag/${TAG}"
