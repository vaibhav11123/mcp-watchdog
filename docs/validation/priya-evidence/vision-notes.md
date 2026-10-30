# Vision notes — agent-inspected stills

Session: 2026-10-30. Tooling: macOS `screencapture` (Computer Use MCP unavailable; Screen Recording granted mid-session). Extension Host: Cursor `--extensionDevelopmentPath` after parking duplicate installs.

## Environment blockers (live)

1. **Duplicate extension collision** — With marketplace `mcp-watchdog.mcp-watchdog-0.2.0` + `local-mcp-watchdog` + EH path loaded together: toast *Cannot register multiple views with same id `mcpWatchdog.servers`*; marketplace activation **fails**; only `local-*` activates. Parked installs → EH activate **success** (`exthost.log` 23:16:25).
2. **Isolated `--user-data-dir` EH** hits Cursor login wall — cannot use for Priya.
3. **Window `-l` capture** on Electron sometimes returned a stale frame; full-display captures used for scoring when hashes stalled.
4. **`test:host`** downloaded VS Code but Electron path ENOENT — host mocha not usable this session; unit/t0/t2 remain logic oracles.
5. **Toast actions Reload Window / Quit Cursor** — not fully driven (safety + palette focus steal to agent window). Documented as blocked/partial.

## Per-still observations

| still | what agent saw | score note |
|---|---|---|
| `A0-display.png` | Main agent Cursor; Screen Recording now works | setup |
| `A2-00-eh-front.png` | EH open; activation error toasts; Cursor `MCP: 3/3` (not Watchdog) | fail activate |
| `A2-isolated-eh.png` | Login wall Log In / Sign Up | blocked |
| `A2-eh-fresh.png` / `A2-eh-frontmost.png` | Watchdog sidebar live; toast *monitor 6 MCP server(s)?* **Not now** / **Review & Allow**; status **MCP: untrusted**; Servers Offline list; Overview **Open a folder** | pass activate; **P0 dual UI** |
| `A7-03-after-trust.png` | Trust toast still present; Overview still Open folder; Servers approval copy | trust incomplete |
| `A7-04-trusted-monitoring.png` | 6 servers Offline (aws-mcp, exa, rea, echo, memory, filesystem); Overview still Open folder; Approval required in Servers | **P0** overview vs tree |
| `A7-05-after-statusbar-trust.png` | Clicked status `MCP:`; mcp.json open (echo/memory/filesystem); lint wavy on `"servers"`; Overview still Open folder | status click works; trust QP not confirmed accepted |
| `A5-02-statusbar-click.png` | Status bar chip clickable (`MCP: untrusted`) | pass A5-02 |
| `A3-03-view-logs.png` | View logs / output path exercised | partial |
| `A10-01-cloud-empty.png` | Safari Cloud: name/URL/Watch; table `priya-live` **failed** red; Poll; Dual-truth `[]`; Policy audit create/deny/allow | pass A10 |
| `A10-03-cloud-dual.png` | Dual-truth row `inc-priya-1` ide_state=failed cloud_probe_state=failed; Poll visible; audit refreshed | pass B8 bridge UI |
| `A1-demo-gif.gif` | Repo asset placeholder loop (not live kill→toast) | gap marketing |

## Priya think-aloud (from screen)

> “I opened the test folder and already see six servers in **Servers**, but **Overview** tells me to open a folder. Which one do I trust?”  
> “Status says **MCP: untrusted** — good — but there’s also Cursor’s own **MCP: n/m** elsewhere; easy to confuse.”  
> “Toast asks Review & Allow; Overview doesn’t show the same Review & allow webview CTA I expected from untrusted state — it shows Open folder instead.”  
> “Cloud dashboard is clear: failed in red, Poll, dual-truth JSON, policy audit. That part I understand.”
