# MCP Watchdog — Status switchboard

**Last updated:** 2026-11-08  
**Role:** Bird’s-eye progress + doc routing. Domain SoTs stay authoritative for their slice; this file does **not** re-litigate thesis or architecture.

**Position (one line):** Phases **1–3 in tree** + **4–6 scaffolds** (not brand identity); published **0.5.8** (cadence); Doctor UI **announce = 0.5.7** (Now+ soak; G0 on published Cursor); HostCaps honesty folding; verify **0.5.9 HOLD** until soak + L7 GIF; eng↔Instinct Slack **without Vaibhav midwife** ([GTM-COMMS.md](./GTM-COMMS.md)).

---

## At a glance

| Dial | Now |
|------|-----|
| Claim ladder | Eng: **after bake-off win**. Marketing: **Now+** until 0.6.0 announce |
| GTM owner | **Instinct** — [GTM-ROLE.md](./GTM-ROLE.md); Slack `#mcp-watchdog-gtm`; automation answers Instinct; coding eng posts proactively; Vaibhav only Tier 2+ A + money |
| Product phases | **1–3 done**; HostCaps fold in flight; **4–6 not primary identity** until after 0.6.0 announce |
| Published vs tree | Marketplace/Open VSX **0.5.8+** cadence; Doctor announce **0.5.7**; verify GTM = next announce-worthy; **no 0.6.0 announce yet** |
| North-star metrics | `DoctorMetrics` diagnose/verify/FP rates; **no public %** until labeled window + Instinct/Vaibhav A |
| Falsification | Not triggered |
| Agent loop | Always-on automation `5f103790-dad6-11f1-8120-06b44be262b7` + proactive `slack-eng` — [GTM-COMMS.md](./GTM-COMMS.md) |

---

## Doc map (open the right file)

| Question | Open |
|----------|------|
| Where are we / what next? | **This file** |
| Staged publish / soak / hard gates | [RELEASE.md](./RELEASE.md) |
| Rigorous testing / live EH / capture sign-off | [TESTING.md](./TESTING.md) |
| Who are we / what can we claim? | [STRATEGY-THESIS.md](./STRATEGY-THESIS.md) |
| How is the system shaped? | [TECHNICAL-ARCHITECTURE.md](./TECHNICAL-ARCHITECTURE.md) |
| Doctor cause / fixtures | [design/CAUSE-CATALOG.md](./design/CAUSE-CATALOG.md) |
| Doctor UI / copy / live checks | [design/SCREEN-SPEC.md](./design/SCREEN-SPEC.md) · [../tasks/todo.md](../tasks/todo.md) |
| Competitive proof | [BAKE-OFF.md](./BAKE-OFF.md) · [validation/bake-off/RUN-2026-11-07-phase3-rebake.md](./validation/bake-off/RUN-2026-11-07-phase3-rebake.md) |
| Ship / marketing cuts | [GTM-PUBLISH.md](./GTM-PUBLISH.md) · [../CHANGELOG.md](../CHANGELOG.md) |
| Instinct / guardrails / Slack | [GTM-ROLE.md](./GTM-ROLE.md) · [GTM-GUARDRAILS.md](./GTM-GUARDRAILS.md) · [GTM-COMMS.md](./GTM-COMMS.md) |
| Pre-tag secret scan | `bash scripts/check-no-secrets.sh` |
| Announce / listing / interviews | [gtm/ANNOUNCE-DRAFT-0.5.7.md](./gtm/ANNOUNCE-DRAFT-0.5.7.md) · [gtm/ANNOUNCE-DRAFT-0.6.0.md](./gtm/ANNOUNCE-DRAFT-0.6.0.md) · [gtm/LISTING-DRAFT-0.5.7.md](./gtm/LISTING-DRAFT-0.5.7.md) · [gtm/INTERVIEW-BRIEF.md](./gtm/INTERVIEW-BRIEF.md) |
| Agent skills allowlist | [AGENT-SKILLS.md](./AGENT-SKILLS.md) |

---

## Progress board

### Engineering phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | Doctor + RuntimeObservation + UI | **Done** — 0.5.7 SIGN-OFF READY; listing applied; announce kit live |
| 2 | HostCapabilities | **Folded** — Fix omits `restart.editorMcp` when `!canRestartServer`; cadence; **no Instinct announce** |
| 3 | verifyRecovery + incidents + Overview Verified | **In tree** + L7 host/unit hooks; announce after soak — [v0.5.9/SIGN-OFF.md](./validation/release-evidence/v0.5.9/SIGN-OFF.md) **HOLD** |
| 4 | Cross-host patterns + golden fixtures | **Fixtures landed** (unit); not brand identity |
| 5 | Compat / behavioural evidence | **softStop** scaffold landed; not brand identity |
| 6 | Harness CLI | **`bin/mcp-watchdog.mjs` scaffold**; distribution narrative later; not brand pivot |

### 30-day validation

| Item | Status |
|------|--------|
| Bake-off | Done **35/36** — public win waits **0.6.0** + Vaibhav A |
| Doctor UI Must | Done |
| Live EH 0.5.7 | READY |
| Heavy-user interviews | Brief ready — Instinct outreach ([gtm/INTERVIEW-BRIEF.md](./gtm/INTERVIEW-BRIEF.md)) |
| Staged publish | **0.5.7 announce soak**; cadence **0.5.8**; next announce-worthy = verify |
| Public diagnose% / resolve% | Open (post–labeled window) |

---

## Maintenance rules (keep siblings honest)

Update **this file first** when position changes, then domain owners (STRATEGY / ARCH / CAUSE / SCREEN / BAKE-OFF / GTM / TESTING).

Agents: open **STATUS** first. Before tag/publish: **RELEASE** + **TESTING**. Slack Instinct proactively per GTM-COMMS (no Vaibhav wake for ordinary eng↔Instinct).

---

## Next 1–3 actions

1. Instinct posts **0.5.7** Doctor UI (Now+) from [gtm/ANNOUNCE-DRAFT-0.5.7.md](./gtm/ANNOUNCE-DRAFT-0.5.7.md); keep soak clock (≥3d from G0 ~2026-11-07).  
2. After soak: verify GIF + L7 host → [v0.5.9 SIGN-OFF](./validation/release-evidence/v0.5.9/SIGN-OFF.md) READY → Instinct verify announce (still Now+).  
3. Interviews ([INTERVIEW-BRIEF](./gtm/INTERVIEW-BRIEF.md)); then **0.6.0** bake-off announce prep ([ANNOUNCE-DRAFT-0.6.0](./gtm/ANNOUNCE-DRAFT-0.6.0.md)) — **Vaibhav A** before public post.

---

## Do not (until this board says so)

- Collapse Unreleased into one production cut / skip TESTING sign-off  
- Phase 4–6 product work as the **primary identity** move (scaffolds OK; brand still Doctor/verify/bake-off train)  
- Required proxy / Cloud-first / JetBrains-first  
- Sixth UI state · Doctor wizard webview · sidebar illustrations  
- Public “best at recovery” / diagnose% without evidence  
- Claiming host healthy when `hostConnection` is Unknown  
