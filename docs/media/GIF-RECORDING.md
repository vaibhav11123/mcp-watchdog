# GIF recording — live demo (G1)

Copy of launch script for docs (launch/ may be gitignored).

## Setup

1. F5 **Run Extension (mcp-watchdog-test)** or install local VSIX (clean EH: `--disable-extensions` / `--profile-temp`).
2. `mcpWatchdog.requireApproval: false`; only **echo** enabled (disable other servers via `perServer`).
3. Kap / CleanShot / Cmd+Shift+5 — crop status bar + Watchdog sidebar; dark theme.
4. No secrets in frame.

## Script (~15s master.mp4)

1. 0–3s: Overview + `Watchdog: 1/1` (or `n/m` with only echo healthy)
2. 3–5s: `kill -9 $(pgrep -f echo-server.js)`
3. 5–10s: hold toast (Reconnect / Show Log / Reload Window / Quit / Mute)
4. 10–14s: click Reconnect
5. 14–18s: healthy again

Overwrite `images/demo.gif` (≤5 MB) + `docs/media/demo-x.mp4`. Remove placeholder note from README.
