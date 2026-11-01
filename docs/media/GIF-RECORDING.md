# GIF recording — Accept / Fix / Remove recovery

Overwrite `images/demo.gif` (≤5 MB) only after this Accept-first story is recorded. Do not caption an older Retry-only GIF as live.

## Setup

1. F5 **Run Extension (mcp-watchdog-test)** (or clean Extension Host).
2. `mcpWatchdog.requireApproval: false`; only **echo** enabled (`perServer`).
3. Kap / CleanShot / Cmd+Shift+5 — crop status bar + Watchdog sidebar + notification. Dark theme.
4. **No secrets in frame** (no env values, no API keys, no AWS login terminal with profiles).
5. Optional: enable `cloudBridge` only if Cloud is local and you will not show raw payloads with secrets (there should be none).

## Script (~20s) — Accept story

1. **0–3s:** Overview + status chip with echo healthy (`Watchdog: 1/1` or equivalent).
2. **3–5s:** Kill echo (`pkill -f echo-server.js` or stop the process).
3. **5–10s:** Hold the failure toast. Actions visible: **Retry probe**, **Accept**, **Fix…**, **Remove** (and Restart editor MCP if the host exposes it).
4. **10–14s:** Click **Accept**. Chip drops the failure (N/M). Overview still shows Failed with **Accepted** badge — dual-truth beat.
5. **14–17s:** Optional Fix beat (echo only): open **Fix…** QuickPick, pick **Retry probe** or **Open MCP Config** — never live aws login / Exa wizard with real keys.
6. **17–20s:** Optional Remove beat on a disposable temp server key (not echo), or end on Accepted overview.

## Out of frame

- Live AWS terminal (`aws login`)
- Real Exa credential wizard
- Env/header values

After recording: replace `images/demo.gif`, embed in README Demo, note date in CHANGELOG Unreleased.
