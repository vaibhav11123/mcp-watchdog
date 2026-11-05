# PUBLISH-HANDOFF — 0.5.5

## Release version

`0.5.5` (applied in `package.json`). Tag: `v0.5.5`.

## Blocker before useful telemetry

1. Maintainer runs `npx -y @posthog/wizard@latest` (credentials / project only — discard any SDK tree edits).
2. Paste **Project API Key** + matching-region host into [`src/telemetry/config.ts`](../../../src/telemetry/config.ts) (`POSTHOG_API_KEY`, `POSTHOG_HOST`). Empty key = no-op Capture client.
3. Rebuild; optional F5 smoke with `MCP_WATCHDOG_TELEMETRY_DEBUG=1` in Development → PostHog Live `activation`.

## Agent / maintainer path

1. Gates: `npm run compile && npm run build && npm run test:unit && npm run lint && npm run format:check && npm run triage-e2e`
2. Confirm `telemetry.json` in `npx @vscode/vsce ls`
3. Commit release on `main`
4. `git tag v0.5.5 && git push origin main && git push origin v0.5.5`
5. Actions `release.yml` → GitHub Release + `.vsix` + Marketplace (`VSCE_PAT`) + Open VSX (`OVSX_PAT`)
6. Confirm listings show **0.5.5**; one real install → PostHog Live `activation`

## If PATs missing

Add repo secrets `VSCE_PAT` and `OVSX_PAT`, then re-run the Release workflow (`workflow_dispatch`) or use `republish.yml` (already-published = OK).

## Announce

See [docs/GTM-PUBLISH.md](../../GTM-PUBLISH.md) §G — do not claim “no telemetry”.
