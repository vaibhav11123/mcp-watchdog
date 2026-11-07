# Announce draft — 0.5.7 Doctor UI (Now+)

**Owner:** Instinct drafts/posts. Eng supplies facts.  
**Claim stage:** **Now+** — do **not** say bake-off win, diagnose%, resolve%, auto-heal, or “editor session is healthy.”  
**Install first:** [Open VSX](https://open-vsx.org/extension/mcp-watchdog/mcp-watchdog) (Cursor ICP); Marketplace same VSIX.  
**Soak:** ≥3 days after Open VSX shows cut + G0 before next announce-worthy post.

## Short (X / LinkedIn)

MCP Watchdog 0.5.7: when an MCP server fails, you get a plain-language cause — not a raw log dump — and a toast with at most three actions (Fix… / Show Log / Mute). Green on the chip is Watchdog’s own connection, not the editor session.

Open VSX: https://open-vsx.org/extension/mcp-watchdog/mcp-watchdog

## Longer (forum / HN / Discussions)

**Title idea:** MCP Watchdog 0.5.7 — cause-first failure UI for Cursor / VS Code

MCP servers can look fine in the editor while the upstream process is dead. Watchdog runs an independent probe.

In **0.5.7** the Doctor UI cut lands for operators:

- Cause **sentences** on Overview, toast, and status (not raw error headlines).
- Failure toast capped at **three** actions: Fix…, Show Log, Mute 1h.
- Overview metric **Reconnecting** (not “Active”); Fix Quick Pick title includes causeId.

**Honest limit:** Watchdog does not claim the editor’s MCP session is Connected. Failed/degraded rows can show **Editor session: Unknown**.

**Not in this announce:** bake-off rankings, diagnose%/resolve% numbers, “best at recovery.”

Install (Cursor): Open VSX → MCP Watchdog. Changelog: https://github.com/vaibhav11123/mcp-watchdog/blob/main/CHANGELOG.md

## Eng handoff checklist for Instinct

- [x] Listing strings applied (description / README / walkthrough)
- [ ] Instinct draft in `launch/` or this channel
- [ ] Vaibhav A only if Tier 2+ (forum/HN blast) — Tier 3 changelog+short X can proceed per GTM-ROLE
