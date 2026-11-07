# MCP Watchdog — Status switchboard

**Last updated:** 2026-11-08 (post STATUS-train push `21e5cbe`; CI green)  
**Role:** Bird’s-eye progress + doc routing. Domain SoTs stay authoritative for their slice; this file does **not** re-litigate thesis or architecture.

**You are here (one line):** On the **0.5.7 Doctor announce soak** clock. Code for Phases 1–3 + HostCaps honesty is on `main` / registries (cadence **0.5.8**). Verify announce (**0.5.9**) and bake-off win (**0.6.0**) are **not** public yet. Phases 4–6 are **scaffolds only** (not the brand). Claim stage for marketing: **Now+**.

---

## Progress train (read this first)

```text
DONE eng+GTM kit     SOAK NOW ●              NEXT                    LATER
───────────────     ─────────────           ─────                   ─────
0.5.7 Doctor UI  →  ≥3 days from G0  →  0.5.9 verify announce  →  0.6.0 bake-off
listing+announce    (~2026-11-07)       SIGN-OFF HOLD               draft ready;
kit; SIGN-OFF READY  earliest ~11-10    needs GIF + soak            Vaibhav A
                    HostCaps folded
                    silent (0.5.8)

Phases 4–6 scaffolds on main (fixtures / softStop / CLI bin) — NOT brand identity
```

| Beat | What it means | Where we are |
|------|----------------|--------------|
| **0.5.7 Doctor UI** | Cause sentences, toast ≤3, Reconnecting — **announce story** | Eng **done**; listing applied; announce draft live; G0 noted; **Instinct should post**; soak running |
| **0.5.8 HostCaps** | Honest Fix (no restart when host can’t) | Eng **folded** into cadence; **no Instinct announce** |
| **0.5.9 Verify** | Overview `Verified:` after Fix | Code + L7 hooks **in tree**; SIGN-OFF **HOLD** until soak + GIF |
| **0.6.0 Bake-off win** | Cite 35/36 re-bake publicly | Eng evidence **done**; announce draft **prep only**; **Vaibhav A** before post |
| **Phases 4–6** | Fixtures / soft-stop / harness CLI | **Scaffolds landed**; full product + brand later |
| **Public diagnose%** | North-star % with FP window | Counters only — **do not announce** |

---

## At a glance

| Dial | Now |
|------|-----|
| Claim ladder | Eng: **after bake-off win** (internal). Marketing: **Now+** until 0.6.0 announce lands |
| GTM owner | **Instinct** — [GTM-ROLE.md](./GTM-ROLE.md); Slack `#mcp-watchdog-gtm`; automation answers Instinct; coding eng posts proactively; Vaibhav only Tier 2+ A + money |
| Product phases | **1–3 eng done**; HostCaps **folded**; verify **awaiting soak/GIF**; **4–6 scaffolds** (not primary identity until after 0.6.0 announce) |
| Published vs tree | Registries: cadence **0.5.8+**. Marketing stories: Doctor = **0.5.7**; next announce-worthy = **verify**; **no 0.6.0 announce yet** |
| Last eng land | `main` @ `21e5cbe` (2026-11-08) — CI green; STATUS train Wave A hygiene + Phase 4–6 scaffolds |
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
| 1 | Doctor + RuntimeObservation + UI | **Done** — [v0.5.7 SIGN-OFF](./validation/release-evidence/v0.5.7/SIGN-OFF.md) READY; listing applied; [announce kit](./gtm/ANNOUNCE-DRAFT-0.5.7.md) live |
| 2 | HostCapabilities | **Folded** — Fix omits `restart.editorMcp` when `!canRestartServer`; silent cadence; **no Instinct announce** |
| 3 | verifyRecovery + incidents + Overview Verified | **In tree** + L7 host/unit hooks; **announce blocked** — [v0.5.9 SIGN-OFF](./validation/release-evidence/v0.5.9/SIGN-OFF.md) **HOLD** (soak + GIF) |
| 4 | Cross-host patterns + golden fixtures | **Fixtures landed** (`test/unit/goldenFixtures.test.ts`); not brand identity |
| 5 | Compat / behavioural evidence | **softStop** scaffold landed; not user-visible Overview yet; not brand identity |
| 6 | Harness CLI | **`bin/mcp-watchdog.mjs` scaffold** only; distribution later; not brand pivot |

### GTM / publish beats (separate from “code on main”)

| Beat | Eng | Instinct / public |
|------|-----|-------------------|
| 0.5.7 Doctor announce | Done | **Waiting on Instinct** to draft/post from announce kit; soak ≥3d from G0 ~2026-11-07 |
| 0.5.8 HostCaps | Folded silent | **No announce** |
| 0.5.9 Verify announce | Prep done; SIGN-OFF HOLD | After soak + GIF → Instinct Now+ draft |
| 0.6.0 Bake-off win | Evidence 35/36; [draft prep](./gtm/ANNOUNCE-DRAFT-0.6.0.md) | After verify soak + **Vaibhav A** — eng does not auto-post |
| Interviews | Brief only | Instinct outreach — [INTERVIEW-BRIEF.md](./gtm/INTERVIEW-BRIEF.md) |

### 30-day validation

| Item | Status |
|------|--------|
| Bake-off | Eng done **35/36** — public win waits **0.6.0** + Vaibhav A |
| Doctor UI Must | Done |
| Live EH 0.5.7 | READY |
| Live EH / SIGN-OFF 0.5.9 | HOLD (soak + GIF) |
| Heavy-user interviews | Brief ready — Instinct outreach |
| Staged publish | **On Doctor soak**; cadence **0.5.8** on registries; next announce-worthy = verify |
| Public diagnose% / resolve% | Open (post–labeled window) — **not** now |

---

## Maintenance rules (keep siblings honest)

Update **this file first** when position changes, then domain owners (STRATEGY / ARCH / CAUSE / SCREEN / BAKE-OFF / GTM / TESTING).

Agents: open **STATUS** first. Before tag/publish: **RELEASE** + **TESTING**. Slack Instinct proactively per GTM-COMMS (no Vaibhav wake for ordinary eng↔Instinct).

---

## Next 1–3 actions

1. **Instinct:** post **0.5.7** Doctor UI (Now+) from [gtm/ANNOUNCE-DRAFT-0.5.7.md](./gtm/ANNOUNCE-DRAFT-0.5.7.md); keep soak clock (≥3d from G0 ~2026-11-07 → earliest next announce window ~2026-11-10).  
2. **After soak:** verify GIF + L7 on cut SHA → [v0.5.9 SIGN-OFF](./validation/release-evidence/v0.5.9/SIGN-OFF.md) READY → Instinct verify announce (still Now+).  
3. **Parallel:** interviews ([INTERVIEW-BRIEF](./gtm/INTERVIEW-BRIEF.md)); then **0.6.0** bake-off ([ANNOUNCE-DRAFT-0.6.0](./gtm/ANNOUNCE-DRAFT-0.6.0.md)) — **Vaibhav A** before any public bake-off post.

---

## Do not (until this board says so)

- Collapse Unreleased into one production cut / skip TESTING sign-off  
- Phase 4–6 product work as the **primary identity** move (scaffolds OK; brand still Doctor/verify/bake-off train)  
- Required proxy / Cloud-first / JetBrains-first  
- Sixth UI state · Doctor wizard webview · sidebar illustrations  
- Public “best at recovery” / diagnose% without evidence  
- Claiming host healthy when `hostConnection` is Unknown  
- Treating “code on main” as “announce shipped”  
