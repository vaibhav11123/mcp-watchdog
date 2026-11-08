#!/usr/bin/env bash
# Cloud Agent Build install — idempotent.
# Multi-repo env must include vaibhav11123/mcp-watchdog-ops so STATUS/GTM docs are readable.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

link_ops() {
  local cand
  for cand in \
    "${ROOT}/../mcp-watchdog-ops" \
    "${ROOT}/../../mcp-watchdog-ops" \
    "${HOME}/mcp-watchdog-ops" \
    "/workspace/mcp-watchdog-ops"
  do
    if [[ -d "${cand}/.git" || -f "${cand}/STATUS.md" || -f "${cand}/DUAL-REPO.md" ]]; then
      mkdir -p "${ROOT}/docs"
      # Replace empty/missing submodule dir with symlink to sibling clone
      if [[ -L "${ROOT}/docs/ops" ]]; then
        rm -f "${ROOT}/docs/ops"
      elif [[ -d "${ROOT}/docs/ops" ]] && [[ ! -f "${ROOT}/docs/ops/STATUS.md" ]]; then
        rmdir "${ROOT}/docs/ops" 2>/dev/null || rm -rf "${ROOT}/docs/ops"
      fi
      if [[ ! -e "${ROOT}/docs/ops" ]]; then
        ln -sfn "${cand}" "${ROOT}/docs/ops"
        echo "Linked docs/ops → ${cand}"
      else
        echo "docs/ops already present ($(ls "${ROOT}/docs/ops/STATUS.md" 2>/dev/null || echo no-STATUS))"
      fi
      return 0
    fi
  done
  echo "WARN: mcp-watchdog-ops not found beside this repo."
  echo "      Create a multi-repo Cloud Environment with both:"
  echo "      vaibhav11123/mcp-watchdog + vaibhav11123/mcp-watchdog-ops"
  return 0
}

link_ops
npm ci
npm run compile
npm run build
echo "Cloud install done. Ops STATUS: $(test -f docs/ops/STATUS.md && echo OK || echo MISSING)"
