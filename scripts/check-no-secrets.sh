#!/usr/bin/env bash
# Pre-tag / pre-PR secret scan for tracked public mcp-watchdog files only.
# Fail if real-looking tokens appear outside known synthetic test fixtures.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Real-looking values only (docs may mention the prefixes as warnings).
PATTERN='xox[bpa]-[0-9]+-[0-9]+-[A-Za-z0-9-]+|xoxb-[0-9]+-[0-9A-Za-z-]+|AKIA[0-9A-Z]{16}|sk-live-[A-Za-z0-9]{8,}|sk-proj-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (RSA |OPENSSH )?PRIVATE KEY-----'

ALLOW_PATHS=(
  'test/unit/secretRedact.test.ts'
  'scripts/check-no-secrets.sh'
)

if ! command -v rg >/dev/null 2>&1; then
  echo "check-no-secrets: rg (ripgrep) required" >&2
  exit 1
fi

# Home Cursor MCP must stay outside the repo (advisory)
if [[ -f "$ROOT/.cursor/mcp.json" ]]; then
  echo "check-no-secrets: FAIL — found $ROOT/.cursor/mcp.json (do not keep user MCP secrets in the repo tree)" >&2
  exit 1
fi

hits=""
while IFS= read -r -d '' file; do
  skip=0
  for allow in "${ALLOW_PATHS[@]}"; do
    if [[ "$file" == "$allow" ]]; then
      skip=1
      break
    fi
  done
  if [[ $skip -eq 1 ]]; then
    continue
  fi
  # Never scan private ops submodule / symlink contents via working tree paths
  if [[ "$file" == docs/ops || "$file" == docs/ops/* ]]; then
    continue
  fi
  if match="$(rg -n -e "$PATTERN" -- "$file" 2>/dev/null || true)"; then
    if [[ -n "$match" ]]; then
      hits+="${match}"$'\n'
    fi
  fi
done < <(git ls-files -z)

if [[ -n "${hits}" ]]; then
  echo "check-no-secrets: FAIL — possible secrets in tracked files:" >&2
  echo "$hits" >&2
  echo "Never commit ~/.cursor/mcp.json or paste xoxb-/AKIA/sk-live-/ghp_ into README/CHANGELOG/PRs." >&2
  exit 1
fi

echo "check-no-secrets: OK"
