# Bake-off competitive run — 2026-11-07

**Host:** `darwin-local-bakeoff` (macOS, Node 22)  
**Method:** [docs/BAKE-OFF.md](../../BAKE-OFF.md) S1–S6  
**Artifacts:** `scripts/bake-off/.artifacts/run-2026-11-07/` (live HTTP meta, per-product JSON, status captures)  
**Runner:** `scripts/bake-off/run-full-bakeoff.mjs` + bastion/orbit refine

## Pins exercised (no DNF)

| ID | Artifact | How exercised |
|----|----------|---------------|
| watchdog | This repo 0.5.6 Doctor | Live HTTP fixture errors → causeId classifier; S6 dual-truth policy |
| bastion-proxy | `mcp-bastion@1.5.0` (npm) | Stdio MCP client → `bastion__status` / reconnect against fixtures |
| pacemaker | `mcp-pacemaker@2.1.2` (npm) | CLI `doctor` / `status` / `init` attempts (isolated instance) |
| orbit | `oaslananka.orbit-vsx@0.6.1` VSIX + `health-monitor-mcp@1.4.0` | Companion `register_server` + `check_server` (Orbit UI requires companion) |
| workbench-wb00 | `wheelbarrel00.mcp-workbench-wb00@0.4.9` VSIX | MCP SDK `initialize` parity with documented Test Connection |
| mcpgawk | `gawk-dev.mcpgawk@0.1.83` VSIX + `mcpgawk` CLI | CLI `scan` on machine configs; extension present |

## Totals (max 36 = 6 scenarios × 6)

| Product | Total | Notes |
|---------|------:|-------|
| **watchdog** | **30/36** | Diagnose 12/12 on S1–S5 causeIds; recover=1 (Fix path, not verified restore); honesty=2 |
| bastion-proxy | 25/36 | S2 `lastError` HTTP 401 → auth.rejected (diagnose 2); S4 ENOENT (2); HTTP JSON-RPC auth stubs often timeout negotiation (diagnose 1) |
| mcpgawk | 23/36 | Inventory + AUTH/UNREACHABLE honesty; weak recover; not causeId taxonomy |
| pacemaker | 19/36 | Bridge doctor surface; does not emit auth.missing/rejected/expired classes |
| orbit | 19/36 | Companion reports timeout/down/401; not agnostic causeId; no editor dual-truth |
| workbench-wb00 | 19/36 | Surfaces raw connect errors (ENOENT/401); no Fix/verify loop; S6 dual-truth absent |

**Recover=2:** not awarded to any product (no verified healthy re-probe after remediation in this run).

## Per-scenario (Watchdog)

| ID | D | R | H | Evidence |
|----|---|---|---|---------|
| S1 | 2 | 1 | 2 | Live `/s1` → `auth.missing` |
| S2 | 2 | 1 | 2 | Live 401 → `auth.rejected` |
| S3 | 2 | 1 | 2 | Live expired language → `auth.expired` |
| S4 | 2 | 1 | 2 | ENOENT spawn → `spawn.enoent` |
| S5 | 2 | 1 | 2 | Retries peel → underlying `auth.missing` |
| S6 | 2 | 1 | 2 | `hostConnection: unknown` dual-truth |

## Competitor highlights (evidence on disk)

- **Bastion S2** `bastion__status`: `lastError` = `authentication failed: … HTTP 401 Unauthorized` (state `reconnecting`; `bastion__reconnect` available).
- **Bastion S4**: spawn ENOENT + auto reconnect scheduling.
- **Orbit/health-monitor S1**: `status: timeout`, alert `down` — actionable but not `auth.missing`.
- **Orbit S2 refine:** inferred `auth.rejected` from check payload.
- **Workbench probe:** S2 raw SDK error includes Unauthorized; S4 `spawn … ENOENT`; S1/S3/S5 timeouts against stub.
- **mcpgawk CLI:** scanned local fleet; warned on unparsable Antigravity config; local-launch caution (honesty).
- **Pacemaker:** package installed; `--instance` bootstrap did not create `instance.json` in this environment — doctor still answers “bridge wiring” job, not auth taxonomy (scored, not DNF).

## Claim ladder

Watchdog **leads this dated run** (30 ≥ each alternative).  
**Do not claim “bake-off win” in marketing** until recover can score verified restores (Recover=2) on the same fixtures and results are reproduced once more — this run still has recover capped at 1 for everyone.

## Reproduce

```bash
node scripts/bake-off/fixtures/live-http-servers.mjs &
node scripts/bake-off/run-full-bakeoff.mjs
# optional refine:
node scripts/bake-off/refine-competitors.mjs
```
