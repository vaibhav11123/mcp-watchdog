#!/usr/bin/env bash
# One-time: store publish tokens as GitHub Actions secrets.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v gh >/dev/null; then
  echo "Install GitHub CLI: https://cli.github.com/"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Run: gh auth login"
  exit 1
fi

set_secret() {
  local name=$1
  local value=$2
  if [[ -z "$value" ]]; then
    echo "Skip $name (empty)"
    return
  fi
  printf '%s' "$value" | gh secret set "$name"
  echo "Set $name"
}

if [[ -z "${VSCE_PAT:-}" ]]; then
  read -rsp "VSCE_PAT (Azure DevOps → Marketplace Publish scope): " VSCE_PAT
  echo
fi

if [[ -z "${OVSX_PAT:-}" ]]; then
  read -rsp "OVSX_PAT (open-vsx.org → Profile → Access Tokens): " OVSX_PAT
  echo
fi

set_secret VSCE_PAT "${VSCE_PAT:-}"
set_secret OVSX_PAT "${OVSX_PAT:-}"

echo "Done. Verify: gh secret list"
echo "Ship next release: git tag v\$(node -p \"require('./package.json').version\") && git push origin HEAD --tags"
