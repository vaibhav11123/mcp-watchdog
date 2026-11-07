#!/usr/bin/env bash
# Wait until GitHub Actions workflow "CI" succeeds for the current HEAD on main.
# Usage: bash scripts/wait-ci.sh
# Exit 0 = green; non-zero = failed / timed out / missing gh.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v gh >/dev/null 2>&1; then
  echo "wait-ci: gh CLI required" >&2
  exit 2
fi

SHA=$(git rev-parse HEAD)
BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "wait-ci: looking for CI run on ${BRANCH} @ ${SHA}"

# Poll until a run appears for this SHA (push may take a few seconds).
RUN_ID=""
for _ in $(seq 1 30); do
  RUN_ID=$(gh run list --workflow=ci.yml --branch "$BRANCH" --limit 20 \
    --json databaseId,headSha,status,conclusion \
    --jq ".[] | select(.headSha==\"${SHA}\") | .databaseId" | head -1 || true)
  if [[ -n "${RUN_ID}" ]]; then
    break
  fi
  sleep 2
done

if [[ -z "${RUN_ID}" ]]; then
  echo "wait-ci: no CI run found for ${SHA} yet — is the push on GitHub?" >&2
  exit 3
fi

echo "wait-ci: watching run ${RUN_ID}"
gh run watch "$RUN_ID" --exit-status
echo "wait-ci: CI green for ${SHA}"
