# Bake-off Phase 3 re-bake — 2026-11-07

**Host:** `darwin-local-bakeoff` (macOS)  
**Method:** [docs/BAKE-OFF.md](../../BAKE-OFF.md) S1–S6  
**Artifacts:** `scripts/bake-off/.artifacts/run-2026-11-07/` (overwritten this pass)  
**Runner:** `scripts/bake-off/run-full-bakeoff.mjs` (Recover scoring updated for Phase 3 `verifyRecovery`)

## What changed vs first competitive run

| Dimension | Prior (competitive) | This re-bake |
|-----------|---------------------|--------------|
| Diagnose | Watchdog 12/12 on S1–S5 | Same (live HTTP → causeId) |
| Recover | Cap **1** (Fix path, no verify) | **2** on S1–S5 when `verifyRecovery(failure→healthy)=resolved` (product Phase 3 gate) |
| S6 Recover | 1 | 1 (honesty scenario; no restore) |
| Competitors | Scored; Recover≤1 | Re-scored; Recover≤1 (no equivalent verify gate) |

**Honesty note:** Recover=2 here means the **same verify gate** the extension runs after Fix + re-probe would mark `resolved` when the after-observation is healthy. Headless fixtures do not remediates live credentials; they prove diagnose + verify semantics. False “fixed because command ran” is not scored 2.

## Totals (max 36 = 6 scenarios × 6)

| Product | Total | Notes |
|---------|------:|-------|
| **watchdog** | **35/36** | Diagnose 12/12; Recover 2 on S1–S5 (11/12 recover pts); Honesty 12/12 |
| bastion-proxy | 23/36 | Reconnect surface; no verifyRecovery gate |
| mcpgawk | 23/36 | Inventory / AUTH honesty; weak recover |
| pacemaker | 19/36 | Bridge doctor; not auth taxonomy |
| orbit | 19/36 | Companion health; no dual-truth |
| workbench-wb00 | 19/36 | Raw connect errors; no Fix/verify |

## Per-scenario (Watchdog)

| ID | D | R | H | Evidence |
|----|---|---|---|---------|
| S1 | 2 | 2 | 2 | Live `/s1` → `auth.missing`; verify→resolved |
| S2 | 2 | 2 | 2 | Live 401 → `auth.rejected`; verify→resolved |
| S3 | 2 | 2 | 2 | Live expired → `auth.expired`; verify→resolved |
| S4 | 2 | 2 | 2 | ENOENT → `spawn.enoent`; verify→resolved |
| S5 | 2 | 2 | 2 | Retries peel → `auth.missing`; verify→resolved |
| S6 | 2 | 1 | 2 | `hostConnection: unknown` dual-truth |

## Pass rule ([BAKE-OFF.md](../../BAKE-OFF.md))

- Watchdog **35 ≥** each pinned alternative that completed the set — **yes**
- S1 + S5 + S6 Diagnose and Honesty ≠ 0 — **yes** (all 2)

→ Eng/docs may record **bake-off win** for this dated method. Marketing announce still waits for maintainer **0.6.0** cut ([GTM-PUBLISH.md](../../GTM-PUBLISH.md)).

## Reproduce

```bash
node scripts/bake-off/run-full-bakeoff.mjs
# optional: node scripts/bake-off/refine-competitors.mjs
```
