# Analyzed brief — MCP operator pain (Cursor / Claude)

**Run:** `mcp-watchdog-operator-pain` · **As of:** 2026-10-30 · **output_product:** analyzed_brief · **scale_mode:** population · **round_mode:** landscape

## Decision-relevant summary

Operator rage is real and recurring: silent or sticky MCP failure, status only inside Settings, recover often requires toggle / Reload Window / **full Quit**. Staff lore: known issue, workarounds, often no ETA. This supports Watchdog’s free wedge (visible fail + recover CTA) **as a problem prior**, not as Gate A pass (Gates require Mom Test interviews).

## Themes (coded)

| Code | Need | Evidence grade | Notes |
|---|---|---|---|
| T1 | Auto-reconnect | FACT (forum threads + staff replies) | Rank 1; Watchdog cannot fully ship |
| T2 | Visibility outside Settings | FACT | Explicit ask on 150510 |
| T3 | Recover without File→Exit | FACT | 149353; staff suggests toggle/reload |
| T4 | Sleep/network silent fail | FACT | 151578; partial VPN fix claimed |
| T5 | UI ≠ reality | FACT | 149363 red after healthy reconnect |
| T6 | Full quit still needed for tool refresh | FACT | 164434, 166216 — Reload sometimes insufficient |

## Quote bank (verbatim themes)

- FACT: Redeploy 1–3×/day prod; users unaware connection closed — must toggle twice (135368 / @roqqit).
- FACT: Staff @deanrie — known; workaround = toggle or reload window (150510).
- FACT: “better way to visualise that MCP is disconnected outside of settings” (150510 / @wildone).
- FACT: Silent fail after sleep; no user notification (151578).
- FACT: Both MCPs `Not connected`; only full restart fixes (149353).
- FACT: Toggle reload of tools unreliable; Cmd+Shift+P Reload Window or quit (164434 / @mohitjain staff).
- FACT: Only full Cursor restart guaranteed for tool list / mcp.json changes (166216 staff).

## Implications for validation (DERIVED)

1. Interview script must separate **want auto-heal** vs **value visibility+recover CTA**.
2. Demo should show toast + Reload **and** honest copy when Quit is the real fix.
3. Recruit from threads listed in product `docs/validation/OUTREACH.md`.

## Coverage gaps

- ASSUMPTION: frequency for a typical power user (need interviews).
- Gap: Claude Code issue corpus not re-scraped live this run (use prior MARKET-RESEARCH links).
- Gap: No primary interviews in this desk run.

## Kill / continue (landscape — no winner crowning)

**Continue** operator-recovery validation. Do **not** treat forum volume as WTP.
