# Security

## Supported versions

We address security issues in the **latest minor release** on `main` (currently **0.5.x**). Older versions may not receive backports unless noted in a GitHub Security Advisory.

## Reporting a vulnerability

Please **do not** open a public issue for undisclosed security problems.

1. Open a **[private security advisory](https://github.com/vaibhav11123/mcp-watchdog/security/advisories/new)** on this repository (GitHub → **Security** → **Report a vulnerability**), or  
2. Email the maintainer with a clear description, reproduction steps, and impact.

We aim to acknowledge reports within a few business days. Thank you for helping keep users safe.

## Scope

This extension runs **user-defined** commands and connects to **user-configured** MCP endpoints (`stdio` / HTTP). Review `.vscode/mcp.json` in shared repos before trusting it.

It does **not** support VS Code **Restricted Mode** (`capabilities.untrustedWorkspaces.supported: false`). Trust the workspace in the editor, then use Watchdog’s own server approval gate before monitoring.

## Secrets and Cloud bridge

- Env var and HTTP header **values** are never written to the Output log, Overview, status bar, product telemetry, or opt-in Cloud bridge. **Names** may appear.
- Credential wizard values go to VS Code SecretStorage (and only into mcp.json if you explicitly dual-write).
- Opt-in `cloudBridge` posts scrubbed, names-only incidents; default off; fail-soft if unreachable.

## Watchdog Cloud (preview)

- Binds **`127.0.0.1` only** (default port `8787`). Do **not** publish the port, set `HOST=0.0.0.0`, or expose Cloud on the public internet without auth.
- Probes may target **local** MCP URLs by design (`http://127.0.0.1:…`). Link-local / cloud metadata addresses (`169.254.0.0/16`, metadata hostnames) are rejected.
- Monitor URLs in API/UI responses omit query strings and fragments.
- Unset `HOST` unless it is `127.0.0.1` / `localhost` — any other value exits the process.

## Product telemetry (PostHog)

- Setting `mcpWatchdog.telemetry.enabled` defaults to **on**; tagged `telemetry` + `usesOnlineServices`.
- Also requires editor telemetry (`isTelemetryEnabled`) and usage enablement. Watchdog setting off → no network (except one `settings_change` when turning product telemetry off).
- Capture posts **bare** event names (not via `TelemetryLogger` sender — the logger prefixes `extensionId/event`). Allowlisted properties only (see [`telemetry.json`](telemetry.json)). Anonymous `installId` in `globalState` — no email, no workspace path.
- Project API key (`phc_…` in `src/telemetry/config.ts`) is a **write-oriented public client token** (PostHog documents this as safe to ship in clients). Personal keys (`phx_…`) must never be committed.
- Distinct from Cloud bridge (user self-host dual-truth). No session replay / autocapture.

## GitHub starring

- Optional click path: Command Palette / Overview / toast may star `vaibhav11123/mcp-watchdog` via local `gh api` when authenticated, else open the repo in a browser.
- Silent path: at most one background `gh api` star attempt per install when `gh` is already authenticated (no UI). Failures are not retried.
