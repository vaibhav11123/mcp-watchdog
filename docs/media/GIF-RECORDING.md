# GIF recording — live failure and recovery

Copy of the launch script. The clip is not shipped until this list is recorded in the Extension Host. Do not caption an older Reconnect GIF as live.

## Setup

1. F5 **Run Extension (mcp-watchdog-test)** or install a local VSIX (clean Extension Host: `--disable-extensions` / `--profile-temp`).
2. `mcpWatchdog.requireApproval: false`; only **echo** enabled (disable other servers via `perServer`).
3. Kap / CleanShot / Cmd+Shift+5 — crop the status bar, the Watchdog sidebar, and the notification. Dark theme.
4. No secrets in frame.
5. The host must expose `workbench.mcp.*` so **Restart editor MCP** appears on the toast. If it does not, record on a VS Code host that does, and do not imply Cursor shows that button.

## Script (~18s)

1. 0–3s: Overview + `Watchdog: 1/1` with only echo healthy.
2. 3–5s: stop the server (`kill -9` on the echo process).
3. 5–10s: hold the real failure toast. **Retry probe** and **Restart editor MCP** are both visible, and they are different buttons.
4. 10–14s: click **Retry probe** only. Watchdog’s row recovers. Do not click Restart editor MCP in this beat.
5. 14–18s: if you show the editor action, trigger a second failure and click **Restart editor MCP** only, so the two actions are not one click.

Overwrite `images/demo.gif` (≤5 MB) and `docs/media/demo-x.mp4` only after that recording. Until then, the README does not embed `images/demo.gif`.
