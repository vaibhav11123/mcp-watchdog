# SECRETS-PASS — leak gate

**Date:** 2026-11-05  
**Scope:** Product scrub + bridge + product telemetry + Tier 3 vendored filesystem. **No live AWS or Exa secret tests.**

## Hard locks confirmed

| Lock | Status |
|------|--------|
| No `aws login` / aws-mcp live probe / AWS SecretStorage wizard against user account | Pass — classifier/`terminal.awsLogin` covered by **frozen strings** in unit tests only |
| No real `EXA_API_KEY` / Exa dashboard login / live Exa MCP secret wizard | Pass — recipe + synthetic fixtures / unit only |
| Env/header **values** never logged, bridged, or telemetried | Pass — unit `secretRedact` + `bridge-scrub` + `telemetry-scrub`; bridge/telemetry reject banned keys |
| Evidence / stills / GIF / REA notes | Names only; vendored filesystem uses sandbox path, no API keys |
| PostHog Capture allowlist | Pass — unit `telemetry-scrub` / `telemetry-client`; empty `POSTHOG_API_KEY` → no-op until maintainer sets key |

## Automated checks

| Check | Result |
|-------|--------|
| `npm run test:unit` — `secretRedact`, `bridge-scrub`, `cloudBridge`, `failureTriage`, `telemetry-*` | Green (194 tests) |
| Host `cloudBridge posts fail then accepted to local Cloud` | Green — payloads are names/state only; `ExtensionMode.Test` silences product telemetry |
| Repo grep for `Bearer …`, `sk-…`, `AKIA…`, `EXA_API_KEY=…`, `api_key=…` values under `src` / `test` / `docs/validation/triage-evidence` / `scripts` / `packages` / `mcp-watchdog-test` (excl. lock/node_modules) | Only hit: synthetic `Bearer sk-live-abc123xyz` **inside** `test/unit/secretRedact.test.ts` asserting redaction |

## Synthetic fixtures allowed

- Unit redact samples (`sk-live-abc123xyz`, `api_key=supersecret`)
- `FIXTURE_*` / frozen aws_session error strings in `failureTriage.test.ts`
- Telemetry unit mocks use placeholder `phc_test` / `phc_x` — not a live PostHog project key
- No real cloud credentials in `mcp-watchdog-test/`

## Verdict

**PASS** — leak gate green for 0.5.5 telemetry close-out (key still empty in `src/telemetry/config.ts` until maintainer wizard).
