# GIF recording — live demo (G1)

Copy of launch script for docs (launch/ may be gitignored).

## Setup

1. **Cursor (preferred):** install local VSIX (`npx @vscode/vsce package` → `cursor --install-extension mcp-watchdog-*.vsix`), open `mcp-watchdog-test` (or this repo). Fleet: workspace `echo` + `memory` + `filesystem` plus Cursor globals `exa` + `rea` + `aws-mcp`.
2. `mcpWatchdog.requireApproval: false`. **`aws-mcp` may stay offline/failed** in the shot (probe `-32602` is fine) — do not block recording on it. Target chip like **`Watchdog: 5/6`** with aws shown failed/offline and the other five healthy.
3. Kap / CleanShot / Cmd+Shift+5 — crop status bar + Watchdog Overview; dark theme.
4. No secrets in frame (env values never; crop away API key UI).

## Script (~15s master.mp4)

1. 0–3s: Overview + status chip with five healthy (aws offline OK)
2. 3–5s: `kill -9 $(pgrep -f echo-server.js)`
3. 5–10s: hold **real** failure toast (Reconnect / Restart editor MCP / Show Log / Reload Window / Quit / Mute)
4. 10–14s: click Reconnect
5. 14–18s: echo healthy again

Overwrite `images/demo.gif` (≤5 MB) + `docs/media/demo-x.mp4`. README Demo must describe a **live** kill→toast→Reconnect clip (no “illustrated” wording).
