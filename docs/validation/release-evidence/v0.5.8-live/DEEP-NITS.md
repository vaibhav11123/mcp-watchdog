# Deep nits — product + GTM (2026-11-08)

Recorder: Cursor eng agent. Companion: [LIVE-RESULTS.md](./LIVE-RESULTS.md).  
Severity: **P0** ship-blocker for announce · **P1** user-visible pain · **P2** hygiene · **P3** polish.

---

## BLOCKED on Vaibhav (screen record)

Computer Use permissions right now: **Accessibility = off**, **Screen Recording = off**.

Without both, agent **cannot** drive Cursor Extension Host or capture a real screen recording of toast → Fix → Overview.

**Please enable for “Cursor Computer Use” (or Cursor) in:**

1. **System Settings → Privacy & Security → Accessibility** → ON  
2. **System Settings → Privacy & Security → Screen Recording** → ON  

Then reply “perms on” — agent will re-check and run the live F5 + screen record pass.

---

## Product / logic nits

| ID | Sev | Finding | Evidence | Suggested fix |
|----|-----|---------|----------|---------------|
| P-CLASS-01 | **P1→fixed in tree** | Was: bare `Max retries exceeded` → **`generic`**. Now: → **`spawn.closed`** (classify.ts + unit/golden). Re-dump Overview L7 still after land. | diagnose + tests 2026-11-08 | Landed; still needs human GIF for announce |
| P-DOC-01 | **P2** | [SCREEN-SPEC.md](../../design/SCREEN-SPEC.md) still marks S-OVERVIEW-FAILED-01, METRIC, FOOTER, TOAST, VERIFY as **untested** | Unit tests + Live EH already cover them | Update SCREEN-SPEC Test column to **tested** + point at `overviewHtml` / `liveEh` / `alerts` |
| P-MEDIA-01 | **P0** for GTM honesty | `images/demo.gif` dated **2025-10-31**; store stills **2025-05-29** — likely **pre–Doctor toast≤3 / Reconnecting** story | `ls -la images/` | Re-record per [GIF-RECORDING.md](../../media/GIF-RECORDING.md) before any Doctor announce that points at demo.gif; replace store screenshots |
| P-CLI-01 | **P1** | `bin/mcp-watchdog` ships in VSIX/package.json `bin` but returns scaffold `ok:false` | `node bin/mcp-watchdog.mjs` | Keep out of user-facing README/bin until loaders work, or print clearer “not shipping yet” and omit from vsce if possible |
| P-SOFT-01 | **P2** | `softStopFromToolDrift` exists but **never rendered** in Overview | rg softStop in `src/` = none | Do not market soft-stop; wire or delete from “shipped” narrative |
| P-THEME-01 | **P3** | Metric/dot healthy color hardcoded `#22c55e` vs other tokens from theme | `overviewHtml.ts` | Prefer chart/theme token for consistency in light themes |
| P-HOST-01 | **P2** | HostCaps honesty folded; Cursor often `canRestartServer=false` — Fix omits restart (good) but users may still expect “Restart MCP” from old GIF/docs | filterFixStepsForHostCaps | Ensure announce/GIF never shows restart on Cursor if unavailable |
| P-L1-01 | **P2** | Live EH L1 empty-window still **skipped** | host suite pending | Disposable empty EH or keep unit-only with STATUS note |
| P-VERIFY-01 | **P2** | L7 host test sets verifiedOutcome via test hook — good for wiring; full Fix→re-probe→resolved path still needs human GIF for announce | LIVE-RESULTS | Keep 0.5.9 SIGN-OFF HOLD until GIF |

**Not broken (this pass):** auth.missing / rejected / enoent / ECONNREFUSED / Connection closed classify correctly; toast≤3 + Fix QP causeId pass in Live EH; dual-truth Unknown on failed rows; CI green.

---

## Visual nits

| ID | Sev | Finding |
|----|-----|---------|
| V-01 | P1 | Overview stills (headless) prove copy; **Cursor chrome + toast + status chip** not yet screen-recorded (perms). |
| V-02 | P0 GTM | Marketplace/Open VSX stills + demo.gif likely **mismatch** Doctor UI Must story (Reconnecting, toast≤3, cause sentences). |
| V-03 | P3 | Failed row primary action sometimes “Show Log” vs “Retry probe” depending on recommend order — OK per catalog, but GIF script should pick intentionally. |

---

## GTM nits

| ID | Sev | Finding | Action |
|----|-----|---------|--------|
| G-01 | **P0** | **0.5.7 Doctor announce not posted** — checklist still open (“Instinct draft”) | Instinct: draft/post from ANNOUNCE-DRAFT-0.5.7; Tier 3 X can go; Tier 2+ needs Vaibhav A |
| G-02 | **P1** | Registries may show **0.5.8** while announce story is **0.5.7** — confusing for Instinct/copy | Always say “Doctor UI cut (0.5.7 story); cadence may show newer patch” |
| G-03 | **P1** | Interviews brief ready; **no confirmed outreach** | Instinct owns; eng only answers product truth |
| G-04 | **P0** | Shipping announce while **demo.gif is stale** risks banned/wrong story (old Retry/Accept-heavy clip) | Hold public media that embeds demo.gif until re-record, or caption “overview stills only” |
| G-05 | **P2** | Soak clock: G0 ~2026-11-07 → earliest next announce-worthy ~**2026-11-10** | Don’t ask Instinct to blast verify/bake-off early |
| G-06 | **P1** | Eng↔Instinct Slack was progress-heavy; needs **nit packet** (this file) so Instinct doesn’t over-claim | Slack this summary now |
| G-07 | **P2** | 0.6.0 bake-off draft exists — must not leak into 0.5.7 posts | Reinforce banned claims |

---

## Slack / Instinct operating gap

Automation answers Instinct without Vaibhav. Coding eng must keep channel warm with **product truth + open asks**, not only “landed on main.” This pack is the missing critical nit layer.

---

## Next after perms

1. F5 `Run Extension (mcp-watchdog-test)` with echo only.  
2. Screen record: healthy → kill echo → toast ≤3 → Overview cause → Fix QP → Verified.  
3. Drop clip under `v0.5.8-live/clips/` (gitignored) + stills; update LIVE-RESULTS.  
4. Decide demo.gif replace vs n/a for 0.5.7 media.
