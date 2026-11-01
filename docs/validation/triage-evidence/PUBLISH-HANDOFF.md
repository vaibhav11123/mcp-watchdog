# PUBLISH-HANDOFF — 0.5.4

## Release version

`0.5.4` (applied in `package.json`). Tag: `v0.5.4`.

## Agent / maintainer path

1. Gates: `npm run compile && npm run build && npm run test:unit && npm run triage-e2e && npm run tier3-filesystem`
2. Commit release on `main`
3. `git tag v0.5.4 && git push origin main && git push origin v0.5.4`
4. Actions `release.yml` → GitHub Release + `.vsix` + Marketplace (`VSCE_PAT`) + Open VSX (`OVSX_PAT`)
5. Confirm listings show **0.5.4**

## If PATs missing

Add repo secrets `VSCE_PAT` and `OVSX_PAT`, then re-run the Release workflow (`workflow_dispatch`) or re-tag carefully (prefer re-run, not retag).

## Announce

See [docs/GTM-PUBLISH.md](../../GTM-PUBLISH.md) §G.
