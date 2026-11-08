#!/usr/bin/env bash
# Cadence release: patch-bump + tag when main is ahead of the latest v* tag.
# Intended for CI cron every 2 hours. Does NOT ping GTM / Instinct.
# Gates: commits since last tag, CI green on HEAD (unless SKIP_CI_WAIT=1).
# Disable: ENABLE_CADENCE_RELEASE=false
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "${ENABLE_CADENCE_RELEASE:-true}" != "true" ]]; then
  echo "cadence: ENABLE_CADENCE_RELEASE!=true — skip"
  exit 0
fi

git fetch --tags origin 2>/dev/null || git fetch --tags || true
git fetch origin main 2>/dev/null || true

LAST_TAG=$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null || echo "")
HEAD=$(git rev-parse HEAD)
echo "cadence: HEAD=${HEAD} last_tag=${LAST_TAG:-none}"

if [[ -n "${LAST_TAG}" ]]; then
  AHEAD=$(git rev-list --count "${LAST_TAG}..HEAD")
  if [[ "${AHEAD}" -eq 0 ]]; then
    echo "cadence: no commits since ${LAST_TAG} — skip"
    exit 0
  fi
  echo "cadence: ${AHEAD} commit(s) since ${LAST_TAG}"
else
  echo "cadence: no prior v* tag — will cut first cadence from package.json"
fi

if [[ "${SKIP_CI_WAIT:-0}" != "1" ]]; then
  if command -v gh >/dev/null 2>&1; then
    CONCL=$(gh run list --workflow=ci.yml --branch main --limit 40 \
      --json headSha,conclusion \
      --jq ".[] | select(.headSha==\"${HEAD}\") | .conclusion" | head -1 || true)
    if [[ "${CONCL}" == "success" ]]; then
      echo "cadence: CI already green for ${HEAD}"
    else
      echo "cadence: waiting for CI on ${HEAD} (last conclusion=${CONCL:-none})"
      bash scripts/wait-ci.sh
    fi
  else
    echo "cadence: gh not available — run npm test locally"
    npm test
  fi
fi

bash scripts/check-no-secrets.sh

CURRENT=$(node -p "require('./package.json').version")
NEXT=$(node -p "
  const [a,b,c] = '${CURRENT}'.split('.').map(Number);
  if ([a,b,c].some(n => Number.isNaN(n))) throw new Error('bad version');
  [a, b, c + 1].join('.');
")
TAG="v${NEXT}"
echo "cadence: bump ${CURRENT} → ${NEXT}"

export NEXT_VERSION="${NEXT}"
node <<'NODE'
const fs = require('fs');
const next = process.env.NEXT_VERSION;
const date = new Date().toISOString().slice(0, 10);

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = next;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
lock.version = next;
if (lock.packages && lock.packages['']) lock.packages[''].version = next;
fs.writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n');

let text = fs.readFileSync('CHANGELOG.md', 'utf8');
if (text.includes(`## [${next}]`)) throw new Error(`CHANGELOG already has ${next}`);
const section = `## [${next}] - ${date}

Cadence patch (2h train). No user-visible change. Live public story remains Doctor **0.5.7** (cause sentence / toast / dual-truth green). See commits since previous tag.

### Changed

- Automated cadence release from \`main\` (CI green + commits since last tag).

`;
if (!text.includes('## [Unreleased]\n')) throw new Error('missing ## [Unreleased]');
text = text.replace('## [Unreleased]\n', `## [Unreleased]\n\n${section}`);
text = text.replace(
  /\[Unreleased\]: https:\/\/github\.com\/vaibhav11123\/mcp-watchdog\/compare\/v[0-9.]+...HEAD/,
  `[Unreleased]: https://github.com/vaibhav11123/mcp-watchdog/compare/v${next}...HEAD`,
);
if (!text.includes(`[${next}]:`)) {
  text = text.replace(
    '[Unreleased]:',
    `[${next}]: https://github.com/vaibhav11123/mcp-watchdog/releases/tag/v${next}\n[Unreleased]:`,
  );
}
fs.writeFileSync('CHANGELOG.md', text);
console.log('cadence: package + CHANGELOG →', next);
NODE

npm test
npx @vscode/vsce package -o "mcp-watchdog-${NEXT}.vsix"
# Runtime + Marketplace surface only. Process docs (GTM, validation evidence,
# tasks/todo, agent kits) must stay out of the VSIX.
if npx @vscode/vsce ls | grep -E '^(docs/|test/|tasks/|launch/|\.agents/)|local\.md|todo\.md|release-evidence|ANNOUNCE-DRAFT|GTM-|SIGN-OFF'; then
  echo "cadence: VSIX contains forbidden process/dev paths" >&2
  npx @vscode/vsce ls | grep -E '^(docs/|test/|tasks/|launch/|\.agents/)|local\.md|todo\.md|release-evidence|ANNOUNCE-DRAFT|GTM-|SIGN-OFF' >&2 || true
  exit 1
fi

if [[ "${CADENCE_DRY_RUN:-0}" == "1" ]]; then
  echo "cadence: CADENCE_DRY_RUN=1 — not committing/tagging/publishing"
  exit 0
fi

git config user.name "${GIT_AUTHOR_NAME:-mcp-watchdog-cadence}"
git config user.email "${GIT_AUTHOR_EMAIL:-cadence@users.noreply.github.com}"
git add package.json package-lock.json CHANGELOG.md
git commit -m "Release ${NEXT}: cadence patch (2h train)."
git tag -a "${TAG}" -m "Release ${TAG} (cadence)"

REMOTE_URL=$(git remote get-url origin)
if [[ -n "${CADENCE_PUSH_TOKEN:-}" ]]; then
  git remote set-url origin "https://x-access-token:${CADENCE_PUSH_TOKEN}@github.com/vaibhav11123/mcp-watchdog.git"
fi
git push origin HEAD:main
git push origin "${TAG}"
if [[ -n "${CADENCE_PUSH_TOKEN:-}" ]]; then
  git remote set-url origin "${REMOTE_URL}"
fi

# GITHUB_TOKEN tag pushes do not re-trigger release.yml — publish here when asked.
if [[ "${CADENCE_SELF_PUBLISH:-1}" == "1" ]]; then
  if [[ -n "${VSCE_PAT:-}" ]]; then
    npx @vscode/vsce publish -p "${VSCE_PAT}" --skip-duplicate || true
  else
    echo "cadence: VSCE_PAT unset — skip Marketplace"
  fi
  if [[ -n "${OVSX_PAT:-}" ]]; then
    npx ovsx publish "mcp-watchdog-${NEXT}.vsix" -p "${OVSX_PAT}" --skip-duplicate || true
  else
    echo "cadence: OVSX_PAT unset — skip Open VSX"
  fi
  if command -v gh >/dev/null 2>&1; then
    gh release create "${TAG}" "mcp-watchdog-${NEXT}.vsix" \
      --title "${TAG}" \
      --notes "Cadence patch ${NEXT}. No user-visible change. Live public story remains Doctor 0.5.7 (cause sentence / toast / dual-truth green). CI was green on the pre-bump SHA; release commit is this tag." \
      --verify-tag || echo "cadence: gh release create skipped/failed (may already exist)"
  fi
fi

echo "cadence: shipped ${TAG}"
