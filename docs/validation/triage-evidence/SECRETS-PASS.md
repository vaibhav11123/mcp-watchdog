# SECRETS-PASS — leak gate

**Date:** 2026-11-01  
**Scope:** Product scrub + bridge + evidence + Tier 3 vendored filesystem. **No live AWS or Exa secret tests.**

## Hard locks confirmed

| Lock | Status |
|------|--------|
| No `aws login` / aws-mcp live probe / AWS SecretStorage wizard against user account | Pass — classifier/`terminal.awsLogin` covered by **frozen strings** in unit tests only |
| No real `EXA_API_KEY` / Exa dashboard login / live Exa MCP secret wizard | Pass — recipe + synthetic fixtures / unit only |
| Env/header **values** never logged or bridged | Pass — unit `secretRedact` + `bridge-scrub`; bridge rejects banned keys |
| Evidence / stills / GIF / REA notes | Names only; vendored filesystem uses sandbox path, no API keys |

## Automated checks

| Check | Result |
|-------|--------|
| `npm run test:unit` — `secretRedact`, `bridge-scrub`, `cloudBridge`, `failureTriage` (aws_session strings) | Green (181 tests) |
| Host `cloudBridge posts fail then accepted to local Cloud` | Green — payloads are names/state only |
| Repo grep for `Bearer …`, `sk-…`, `AKIA…`, `EXA_API_KEY=…`, `api_key=…` values under `src` / `test` / `docs/validation/triage-evidence` / `scripts` / `packages` / `mcp-watchdog-test` (excl. lock/node_modules) | Only hit: synthetic `Bearer sk-live-abc123xyz` **inside** `test/unit/secretRedact.test.ts` asserting redaction |

## Synthetic fixtures allowed

- Unit redact samples (`sk-live-abc123xyz`, `api_key=supersecret`)
- `FIXTURE_*` / frozen aws_session error strings in `failureTriage.test.ts`
- No real cloud credentials in `mcp-watchdog-test/`

## Verdict

**PASS** — leak gate green for this close-out.
