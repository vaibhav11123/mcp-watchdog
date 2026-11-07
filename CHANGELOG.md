# Changelog

All notable changes to **MCP Watchdog** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.5.8] - 2026-11-07

Cadence patch (2h train). No GTM announce. See commits since previous tag.

### Changed

- Automated cadence release from `main` (CI green + commits since last tag).


### Changed

- Release / agent gates: `npm test` now runs `lint` + `format:check` (same failure mode as `ci.yml`); `scripts/wait-ci.sh` + ship-release waits for main CI after push — Release workflow green is not enough.
- **2-hour cadence releases:** [`.github/workflows/cadence-release.yml`](./.github/workflows/cadence-release.yml) + [`scripts/cadence-release.sh`](./scripts/cadence-release.sh) — patch bump + publish when `main` is ahead of the last tag and CI is green; no GTM announce. Disable with repo var `ENABLE_CADENCE_RELEASE=false`.

## [0.5.7] - 2026-11-07

Marketing: claim stage **Now+**. Public announce story for this cut is **Doctor UI Must** only (cause sentences, toast ≤3, Reconnecting). HostCapabilities / verify ship in the same VSIX; GTM beats for those stay on the 0.5.8 / 0.5.9 map. No bake-off win claim until **0.6.0**.

### Added

- Doctor Phase 1 (vscode-free): `RuntimeObservation`, agnostic `causeId` taxonomy (`auth.missing` / `rejected` / `expired` / …), `diagnose` / `verifyRecovery` / `deriveServerState` in `packages/probe-core`; Fix UI shows causeId; telemetry allowlists `causeId` alongside legacy `failureClass`.
- Doctor UI Must (`SCREEN-SPEC`): cause sentences on Overview/toast/status; toast ≤3 (`Fix…` / `Show Log` / `Mute 1h`); Reconnecting metric; footer essays removed.
- Phase 2 `HostCapabilities` (`src/hostCapabilities.ts`): cursor/vscode/windsurf detection; `canObserveConnectionState: false` on Cursor (announce deferred to 0.5.8 if user-visible).
- Phase 3 verified recovery: post-Fix `verifyRecovery` + Overview `Verified:` line; `.mcp-watchdog/incidents.jsonl` (redacted); DoctorMetrics hooks (announce / GIF beat deferred to 0.5.9).
- Bake-off competitive + Phase 3 re-bake evidence: [docs/validation/bake-off/](./docs/validation/bake-off/) — eng win **35/36**; public announce waits for **0.6.0**.

### Changed

- Overview webview clamps horizontal overflow (`overflow-x: hidden`).
- Host Live EH matrix: `test/host/liveEh.test.ts` (TESTING L2–L6/L8); `AlertManager.clearServer` clears flap/mute between host suites.
- Pre-tag secret scan: [scripts/check-no-secrets.sh](./scripts/check-no-secrets.sh) — RELEASE hard gate.
- Host-test trust gate: `mcp-watchdog-test` default `requireApproval: true`.
- Staged release / QA / GTM docs: [docs/STATUS.md](./docs/STATUS.md), [docs/RELEASE.md](./docs/RELEASE.md), [docs/TESTING.md](./docs/TESTING.md), [docs/GTM-ROLE.md](./docs/GTM-ROLE.md), [docs/GTM-GUARDRAILS.md](./docs/GTM-GUARDRAILS.md), [docs/GTM-COMMS.md](./docs/GTM-COMMS.md), [docs/STRATEGY-THESIS.md](./docs/STRATEGY-THESIS.md), [docs/TECHNICAL-ARCHITECTURE.md](./docs/TECHNICAL-ARCHITECTURE.md).

## [0.5.6] - 2026-11-07

### Fixed

- Product telemetry never reached PostHog from real installs: `TelemetryLogger` prefixes events as `extensionId/event`, which our allowlist then dropped. Capture now posts bare event names after the dual gate (+ usage enablement); the logger is Trace-echo only.
- Activation `serverCount` now reflects merged mcp.json size; added `monitoringCount` for active probes (status bar `N/M` remains healthy/total of Watchdog’s set — not Cursor’s full MCP panel).

### Added

- Telemetry: `ui_command`, triage `surface`, activation `probeMode` / `cloudBridgeEnabled` / `authProbeEnabledCount`; opt-out still emits one `settings_change` when telemetry is turned off.
- GitHub star: Overview link + command; value-triggered toast (max 3, 24h age, cooldowns); click uses `gh api` then browser fallback; silent once-per-install `gh` star when authenticated.
- `MCP_WATCHDOG_STAR_DEBUG=1` bypasses toast install-age for local checks.

### Changed

- Removed first-run telemetry Disable toast (soft-hide opt-out; Settings toggle remains).
- README/Overview: Watchdog monitors merged mcp.json layers; Cursor may list additional editor/plugin MCPs.

## [0.5.5] - 2026-11-05

### Added

- **Product telemetry (PostHog)** — anonymous activation / triage / failure-class events for retention. Setting `mcpWatchdog.telemetry.enabled` **default on**; also requires the editor’s telemetry setting (`vscode.env.isTelemetryEnabled`). Allowlisted properties only; never env/header values, paths, or raw errors. Event dictionary: [`telemetry.json`](telemetry.json). One-time first-run notice with Disable / Open Settings (removed in 0.5.6).
- Dual gate + allowlisted PostHog Capture (no new runtime deps); `TelemetryLogger` for usage enablement + Trace echo; silent in `ExtensionMode.Test`.

### Changed

- README / SECURITY / TECHNICAL: honesty that product telemetry is on by default (separate from opt-in `cloudBridge`).

## [0.5.4] - 2026-11-01

### Added

- **Accept / Fix… / Remove** on failure toasts, Servers tree, and commands. Accept drops the server from the status-bar **N/M** chip (Overview still shows Failed + Accepted). Fix classifies `aws_session` | `auth` | `spawn` | `generic` with guided steps (copy, open owning config, AWS terminal login, Exa credential wizard, retry). Remove deletes the key from the owning mcp.json (JSONC → refuse + Open/Disable).
- Opt-in per-server **`authProbe`** (`tools/call` after ping); Claude Desktop config layer; secret-safe stderr tail; vendor recipes for Exa/AWS.
- Opt-in **`cloudBridge`**: extension POSTs scrubbed names-only incidents when enabled; Cloud `GET /health`, Add Server dialog, duplicate **409**, `accepted` on dual-truth rows.
- Host hooks: `acceptFailureForTests` / `removeServerForTests` + `MCP_WATCHDOG_HOST_AUTOCONFIRM=1`; live Cloud bridge host E2E.
- `npm run triage-e2e` / `npm run tier3-filesystem`; triage evidence pack under `docs/validation/triage-evidence/`.

### Fixed

- Failure toast when `maxRetries` is 0: emit on **degraded→failed** (previously only healthy/connecting→failed), so host CI / fast give-up paths still notify.
- `lastProbeError` preserved when display error becomes Max retries exceeded (Fix classification).
- Host trust-gate setup applies `requireApproval` before refresh (flaky healthy-without-approval).

### Changed

- Marketplace summary leads with Accept / Fix… / Remove and opt-in Cloud bridge.
- Watchdog Cloud settings describe opt-in self-host bridge (posts when enabled).
- GIF shot list is Accept-first: [docs/media/GIF-RECORDING.md](docs/media/GIF-RECORDING.md).

## [0.5.3] - 2026-10-30

### Fixed

- Overview no longer shows **Open a folder** when trust is pending: cache last webview HTML and re-apply on resolve/visibility; untrusted always shows **Review & allow**.
- Overview summary no longer claims “All N servers healthy” when some rows are Offline/disabled.
- Extension Host F5: `--disable-extensions` + `--profile-temp` to avoid duplicate view-id registration with marketplace/local copies.
- Host tests on macOS: bump `@vscode/test-electron` so the launcher resolves `Code` (not missing `Electron`).

### Changed

- Status bar chip prefix **`Watchdog:`** (was `MCP:`) so it does not collide with the editor’s MCP chip.
- Demo GIF: live EH still of Watchdog sidebar + illustrated kill→toast→Reconnect story; host suite covers real echo kill→alert.

### Added

- Docs: [docs/EXECUTION.md](docs/EXECUTION.md), [docs/GTM-PUBLISH.md](docs/GTM-PUBLISH.md), [docs/PAID-BOUNDARY.md](docs/PAID-BOUNDARY.md).
- `packages/probe-core` — HTTP pack fixtures, covenant-accurate `diffTools`, bridge scrub (names-only).
- `packages/cloud` — Watchdog Cloud MVP (monitor, bridge ingest, policy/trust plane, dashboard).
- Opt-in settings `mcpWatchdog.cloudBridge.enabled` / `.url` (default off).
- Direction scripts: `npm run t0`, `npm run t2`; fixture MCP server.
- CLA draft + CONTRIBUTING.
- **Restart editor MCP** toast action when the host exposes `workbench.mcp.*`.

## [0.5.2] - 2026-10-29

### Changed

- Declare **`capabilities.untrustedWorkspaces.supported: false`**: the extension does not activate in VS Code Restricted Mode (it launches user-configured MCP commands/URLs after its own trust gate).

## [0.5.1] - 2026-10-08

### Fixed

- **Multi-root Problems lint:** Diagnostics now cover `.vscode`/`.cursor` mcp.json in **all** workspace folders (not only the first).
- **Open MCP Config:** In multi-root workspaces, pick which folder to open or scaffold.
- Host tests assert `mcpWatchdog.exportIncidentMarkdown` is registered.
- Config lint coverage for `type: "sse"` (with/without `url`).

## [0.5.0] - 2026-10-08

### Added

- Opt-in **`mcpWatchdog.detectToolDrift`**: fingerprint sorted tool names; info toast on change (never forces `failed`).
- Opt-in **`mcpWatchdog.passiveHttpProbe`**: HTTP HEAD/GET before MCP; reachable-but-MCP-fail → degraded advisory.
- **SSE transport:** `type: "sse"` or `url` + `transport: "sse"`.
- **Multi-root workspaces:** merge mcp.json from all folders; trust key joins sorted paths.

## [0.4.0] - 2026-10-08

### Added

- **Incident timeline:** ring buffer of state transitions; command **MCP Watchdog: Export Incident Timeline (Markdown)**.
- **Latency sparklines:** Overview SVG sparkline from the last ~40 healthy ping samples per server.
- Extra MCP config layers: VS Code user `mcp.json`, Windsurf `mcp_config.json`, Claude Code `~/.claude.json`.
- HTTP **401 / Unauthorized** → `lastError: Auth required (HTTP 401)` (still `failed` / `degraded`; no new state).

## [0.3.0] - 2026-10-08

### Added

- **mcp.json Problems lint** (`mcpWatchdog.diagnostics.enabled`, default `true`).
- **Failure context** on failed/degraded servers (tree, Overview, tooltip).
- **`${env:VAR}` / `${userHome}`** expansion (`${input:…}` not expanded).
- Toast action **Quit Cursor** alongside Reconnect / Show Log / Reload Window / Mute.
- Opt-in **`mcpWatchdog.checkEmptyTools`** (`toolCount` advisory only).
- One-time **review prompt** after `mcpWatchdog.reviewAfterRecoveries` (default `3`).
- Status bar tooltip reachability disclaimer; `images/demo.gif` in README (absolute URL).
- Dense technical design document: [docs/TECHNICAL.md](./docs/TECHNICAL.md).
- Ops bench script `scripts/measure-ops.mjs`.

### Changed

- Host-fixture CI isolation for global MCP servers in host tests.
- [SECURITY.md](./SECURITY.md): supported versions **0.3.x**.
- TypeScript `module`/`moduleResolution` → `Node16`.
- README: Open VSX-first; Marketplace packaging uses Shields badges only (no untrusted SVG).

### Fixed

- `vsce package` blocked by untrusted Marketplace SVG badge / embedded SVG logo in README.
- Tool-drift advisory uses `toolDriftNote` (not `lastError`) so healthy servers do not look failed.

## [0.2.1] - 2026-06-10

### Fixed

- Exclude `launch/` and other dev-only paths from the published VSIX (`.vscodeignore`).

## [0.2.0] - 2026-05-29

### Added

- Vitest unit test infrastructure; pure `config-core.ts` module testable without VS Code host.
- **Trust gate:** `mcpWatchdog.requireApproval` (default `true`) — no stdio/HTTP connections until **Review & Allow**; per-workspace approval until config fingerprint changes.
- Command **MCP Watchdog: Review Trusted Servers**.
- **Probe modes:** `mcpWatchdog.probeMode` (`interval` default, `persistent` legacy); `mcpWatchdog.perServer` overrides.
- **Alerts:** `mcpWatchdog.notify` (`failures` default); failure toasts with Reconnect / Show Log / Reload Window / Mute 1h; flap detection consolidates noisy alerts.
- `mcpWatchdog.pingTimeoutMs`; live settings reload (500ms debounce); ±10% jitter on probe delays.
- Extension host tests (`npm run test:host`); CI matrix (lint, unit OS matrix, integration, host + xvfb).

### Changed

- **Default probe mode is now `interval`** — connect → ping → close each cycle (no long-lived duplicate stdio process between checks).
- SDK dependency tightened to `>=1.29.0 <2.0.0`.

### Security

- No MCP server execution before explicit user consent when `requireApproval` is true (default).

## [0.1.6] - 2026-05-29

### Changed

- **README:** replace retired Shields.io live Marketplace version badge with a static **Install** badge (Shields.io deprecated VS Marketplace API badges).

## [0.1.5] - 2026-05-16

### Added

- **Overview** webview dashboard (metrics, server list, reconnect actions) using VS Code theme colors and ui-ux-pro-max dev-tool palette (#22C55E healthy).
- View toolbar: **Refresh**, **Reconnect all**, **Open MCP config**; context menu **Reconnect** on Servers tree.
- **Show Output Log** command; codicon-based quick pick (no emoji icons).

### Changed

- Tree/status copy uses human-readable labels (**Healthy**, **Reconnecting**, **Failed**) and colored ThemeIcons.
- First-run and walkthrough open **Overview** first.

## [0.1.4] - 2026-05-16

### Added

- **Getting Started walkthrough** (`mcpWatchdog.getStarted`) explaining that the UI is in the activity bar, not the Extensions detail page.
- **First-run:** automatically focuses the **Servers** view once after install.

### Changed

- **Open Servers View** uses the standard `mcpWatchdog.servers.focus` command.

## [0.1.3] - 2026-05-16

### Fixed

- **Empty Servers view on Cursor:** read **`.cursor/mcp.json`** (`mcpServers`) and **`~/.cursor/mcp.json`**, not only **`.vscode/mcp.json`** (`servers`).
- **Empty view after opening a folder:** reload when workspace folders change; watch all MCP config paths.
- **Blank UI with no guidance:** tree **message**, **viewsWelcome**, and **Open MCP Config** command.

### Added

- **MCP Watchdog: Open MCP Config** — open or scaffold Cursor/VS Code MCP config files.

## [0.1.2] - 2026-05-16

### Added

- **README screenshots** for Marketplace/source listings: status bar (`MCP: 2/2`) and **Servers** tree (`images/screenshot-status-bar.png`, `images/screenshot-servers-view.png`).

### Changed

- **`repository` URL** in `package.json` set to **`https://github.com/vaibhav11123/mcp-watchdog`** (canonical form for Marketplace/GitHub linkage).
- **`.vscodeignore`:** tighten packaging excludes (`**/node_modules/**`, **`mcp-watchdog-test`** anywhere under the tree, **`*.vsix`**) so local fixture `node_modules` never ships inside the VSIX.

## [0.1.1] - 2026-05-16

### Changed

- **Extension icon:** 128×128 silhouette mark for Marketplace and activity bar (replaces placeholder).
- **`publisher`** in manifest set to **`mcp-watchdog`** to match the published listing.

## [0.1.0] - 2026-05-15

### Added

- Periodic MCP **ping** loop (configurable interval) with per-request timeout.
- **Exponential backoff** reconnect after ping/connect failures (configurable retries).
- **Window focus** hook for faster checks after sleep or context switch.
- **Status bar** aggregate health (`MCP: healthy/total`).
- **Servers** tree view (activity bar) with live state and ping latency.
- **Output / Log** channel “MCP Watchdog” with timestamps.
- Commands: show status, reconnect all, reconnect one, focus Servers view.
- Reads **`.vscode/mcp.json`** (`servers`); expands **`${workspaceFolder}`** in strings.
- Stdio and streamable HTTP transports via `@modelcontextprotocol/sdk`.

[0.5.8]: https://github.com/vaibhav11123/mcp-watchdog/releases/tag/v0.5.8
[Unreleased]: https://github.com/vaibhav11123/mcp-watchdog/compare/v0.5.8...HEAD
[0.5.7]: https://github.com/vaibhav11123/mcp-watchdog/releases/tag/v0.5.7
[0.5.6]: https://github.com/vaibhav11123/mcp-watchdog/releases/tag/v0.5.6
[0.5.5]: https://github.com/vaibhav11123/mcp-watchdog/releases/tag/v0.5.5
[0.5.4]: https://github.com/vaibhav11123/mcp-watchdog/releases/tag/v0.5.4
[0.5.3]: https://github.com/vaibhav11123/mcp-watchdog/releases/tag/v0.5.3
[0.5.2]: https://github.com/vaibhav11123/mcp-watchdog/releases/tag/v0.5.2
[0.5.1]: https://github.com/vaibhav11123/mcp-watchdog/releases/tag/v0.5.1
[0.1.6]: https://github.com/vaibhav11123/mcp-watchdog/releases/tag/v0.1.6
[0.1.5]: https://github.com/vaibhav11123/mcp-watchdog/releases/tag/v0.1.5
[0.1.4]: https://github.com/vaibhav11123/mcp-watchdog/releases/tag/v0.1.4
[0.1.3]: https://github.com/vaibhav11123/mcp-watchdog/releases/tag/v0.1.3
[0.1.2]: https://github.com/vaibhav11123/mcp-watchdog/releases/tag/v0.1.2
[0.1.1]: https://github.com/vaibhav11123/mcp-watchdog/releases/tag/v0.1.1
[0.1.0]: https://github.com/vaibhav11123/mcp-watchdog/releases/tag/v0.1.0
