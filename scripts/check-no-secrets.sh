#!/usr/bin/env bash
# Pre-tag / pre-PR secret scan for the mcp-watchdog tree.
# Fail if real-looking tokens appear outside known synthetic test fixtures.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Real-looking values only (docs may mention the prefixes as warnings).
PATTERN='xox[bpa]-[0-9]+-[0-9]+-[A-Za-z0-9]+|AKIA[0-9A-Z]{16}|sk-live-[A-Za-z0-9]{8,}|sk-proj-[A-Za-z0-9_-]{8,}|-----BEGIN (RSA |OPENSSH )?PRIVATE KEY-----'

# Paths that may contain intentional fake samples for redact tests / docs about scanning
ALLOW_GLOBS=(
  --glob '!node_modules/**'
  --glob '!.git/**'
  --glob '!**/dist/**'
  --glob '!**/*.vsix'
  --glob '!test/unit/secretRedact.test.ts'
  --glob '!docs/validation/triage-evidence/SECRETS-PASS.md'
  --glob '!scripts/check-no-secrets.sh'
)

if command -v rg >/dev/null 2>&1; then
  if hits="$(rg -n --hidden "${ALLOW_GLOBS[@]}" -e "$PATTERN" . 2>/dev/null || true)"; then
    if [[ -n "${hits}" ]]; then
      echo "check-no-secrets: FAIL — possible secrets in tree:" >&2
      echo "$hits" >&2
      echo "Never commit ~/.cursor/mcp.json or paste xoxb-/AKIA/sk-live- into README/CHANGELOG/PRs." >&2
      exit 1
    fi
  fi
else
  echo "check-no-secrets: rg (ripgrep) required" >&2
  exit 1
fi

# Home Cursor MCP must stay outside the repo (advisory)
if [[ -f "$ROOT/.cursor/mcp.json" ]]; then
  echo "check-no-secrets: FAIL — found $ROOT/.cursor/mcp.json (do not keep user MCP secrets in the repo tree)" >&2
  exit 1
fi

echo "check-no-secrets: OK"
