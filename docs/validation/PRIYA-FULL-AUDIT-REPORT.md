# Priya full audit report — MCP Watchdog

**Date:** 2026-10-30  
**Mode:** LIVE Extension Host + live Cloud `:8787` + agent vision on captures  
**Evidence:** [`priya-evidence/`](./priya-evidence/) (`SCREEN-MAP.md`, `LOGIC-MATRIX.md`, `vision-notes.md`, `think-aloud.md`, `stills/`, `cloud-api.txt`, `unit-logic.txt`)

## Verdict

Live product **activates and surfaces trust**, but Priya hits a **P0 Overview vs Servers dual-truth** before monitoring ever starts. Cloud plane is clearer than the IDE Overview empty state. Unit/t0/t2 oracles are green; live failure→toast matrix was **blocked** because trust never cleanly reached “monitoring.”

## Method

1. Built extension; authored SCREEN-MAP + LOGIC-MATRIX.  
2. Ran `compile` / `test:unit` / `t0` / `t2` / `policy-demo` → `unit-logic.txt`.  
3. Launched Cursor Extension Development Host on `mcp-watchdog-test` (`requireApproval: true`).  
4. After Screen Recording permission: act → `screencapture` → agent inspect image → score.  
5. Cloud UI in Safari + `/v1` curl transcript.  
6. Computer Use MCP was unavailable; Cursor itself is not controllable via that stack — used Accessibility + screencapture.

## What the agent saw (high signal)

### P0 — Overview lies “Open a folder” while folder + servers exist

Stills: `A2-eh-frontmost.png`, `A7-04-trusted-monitoring.png`, `A7-05-after-statusbar-trust.png`.

- Workspace **mcp-watchdog-test** is open; `.vscode/mcp.json` visible with echo/memory/filesystem.  
- **Servers** tree: “Approval required…” + six Offline rows.  
- **Overview** webview: “Open a folder to start monitoring…” + Open folder / View logs.  

Priya cannot reconcile the two panes. Root pattern: Overview `renderEmptyState` defaults to the no-folder message when `empty && configStatus.kind !== 'untrusted'`, while the tree correctly uses `emptyViewMessage(untrusted)`. Live session showed Overview not rendering `renderUntrustedState` despite untrusted status bar.

### P0 — Duplicate extension installs break activation

Still: `A2-00-eh-front.png`. Logs: `Cannot register multiple views with same id mcpWatchdog.servers`; marketplace `mcp-watchdog` activation failure while `local-mcp-watchdog` succeeds. After parking `~/.cursor/extensions/*mcp-watchdog*`, EH activation succeeded (`exthost.log` 23:16:25).

### P1 — Trust toast OK; end-to-end allow not confirmed

Stills: `A2-eh-fresh.png` (Review & Allow / Not now), `A5-02` (status `MCP: untrusted` clickable). After multiple Review/status attempts, Servers still showed approval required (`A7-04`). Live monitor spawn / kill / failure toast **not reached**.

### P1 — Cursor vs Watchdog MCP status language

Before Watchdog load: Cursor chrome `MCP: 3/3`. After: Watchdog `MCP: untrusted`. Easy cross-product confusion for Priya.

### P2 — README demo GIF

Asset still placeholder loop (`A1-demo-gif.gif`); not a live kill→toast recording (known G1 gate).

### Cloud — largely pass

Stills: `A10-01-cloud-empty.png`, `A10-03-cloud-dual.png`. Transcript: `cloud-api.txt`.

- Register + poll → `failed` / `fetch failed` (unreachable URL by design).  
- Policy: deny `npx -y`, allow `node`.  
- Bridge requires `optIn` + schema; accepted payload shows dual-truth row in UI.  
- Poll button and audit `<pre>` visible.

### Logic oracles

| Gate | Result |
|---|---|
| Unit + t0 + t2 + policy-demo | **pass** (`unit-logic.txt`) |
| `test:host` | **fail env** — VS Code Electron ENOENT (`host-logic.txt`) |
| Live B1 state machine / A6 toast actions | **blocked** (no post-trust monitor) |

## Coverage summary

| Area | Attempted | Vision-backed pass | Gaps/blocked |
|---|---|---|---|
| SCREEN-MAP Cloud A10 | 100% | Yes | — |
| SCREEN-MAP IDE Overview/Servers/Status/Trust toast | High | Partial | Dashboard, toast actions, settings |
| LOGIC-MATRIX unit rows | 100% | N/A (oracle) | — |
| LOGIC-MATRIX live monitor/alerts | Forced start | No | Trust incomplete |
| Agent stills | 39 files under `stills/` | Yes | Some EH `-l` frames stale; full display used |

## Recommended fixes (audit only — not implemented)

1. **Overview untrusted path:** Never show “Open a folder” when `workspaceFolders` exist and config is `untrusted` / servers discovered; always prefer `renderUntrustedState`.  
2. **Dev/EH docs:** Warn that installed marketplace/local copies of the same view IDs must be disabled for Extension Development Host.  
3. **Status naming:** Differentiate Watchdog chip copy from Cursor’s built-in MCP status (e.g. `Watchdog: untrusted`).  
4. Re-run Priya live after (1)+(2) to complete A3 dashboard, A6 toast buttons, B1 kills.

## Persona close

Priya would abandon IDE Overview and either click status bar forever or use Cloud — Cloud “failed” is honest; Overview “open a folder” with a folder open is not.

## Post-fix addendum (0.5.3)

| Finding | Disposition | Outcome |
|---|---|---|
| R1 Overview dual-truth | F | Fixed — HTML cache + untrusted body; unit tests |
| R2 EH view clash | F | `launch.json` `--disable-extensions` / `--profile-temp`; CONTRIBUTING |
| R4 `MCP:` chip | F | Renamed to `Watchdog:` |
| R5 Demo GIF | F G1 | New `images/demo.gif` + `docs/media/demo-x.mp4` |
| R8 host Electron | F | `@vscode/test-electron` ^3.1.0; host suite green |
| R3/R9 trust + toast | R | Host: trust gate, echo healthy, kill→Reconnect/Reload |
| xAI live | D | Deferred this wave |

Evidence: [priya-evidence/MASTER-CHECKLIST.md](./priya-evidence/MASTER-CHECKLIST.md), [priya-evidence/LIVE-E2E-RESULTS.md](./priya-evidence/LIVE-E2E-RESULTS.md), [priya-evidence/DIRECTION-PROOFS.md](./priya-evidence/DIRECTION-PROOFS.md).
