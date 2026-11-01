# MCP discovery for triage E2E (Tier 3)

**Date:** 2026-11-01  
**Intent:** Clone a **real-value** third-party MCP; REA inspect/modify **that clone only** — never DUT Watchdog, never live AWS/Exa secrets.

## Market context (why filesystem)

Leaderboards (MCP Tracker / ProtocolProbe / npm) show people actually run: Playwright, Chrome DevTools, **filesystem** (~1.2M wk), Context7, GitHub, Notion/Slack. `everything` / `memory` are protocol demos — useful, not the Priya value story.

## Decision (executed)

| Choice | Detail |
|--------|--------|
| Primary DUT | `@modelcontextprotocol/server-filesystem@2025.11.25` vendored under `mcp-watchdog-test/vendored/filesystem/` |
| Why not HEAD `2.1.0` | engines `node>=24`; this machine is Node 22 — dated package is what many installs still use |
| Allowlist | `vendored/filesystem/sandbox/` only |
| Fail inject | `run-bad-allowlist.mjs` → missing dir → process.exit(1) (REA-confirmed startup gate) |
| Control | Local `fixtures/echo-server.js` |
| Explicitly skipped | Live Exa, AWS/aws-mcp, GitHub/Notion OAuth, Playwright (optional later) |

## REA on clone (not Watchdog)

- Target: `mcp-watchdog-test/vendored/filesystem/pkg/node_modules/@modelcontextprotocol/server-filesystem`
- Operation: `analyze_javascript_application` (summary) on `dist/index.js`, `dist/lib.js`, `package.json`
- Finding used for patch: argv allowlist + `process.exit(1)` on inaccessible directory
- Secrets: none in analysis notes (names only)

## Wiring

- Healthy: `node …/run-healthy.mjs` via workspace `.vscode/mcp.json` server `filesystem-vendored` (disabled by default in settings; enable for Tier 3 ladder)
- Fail: point args at `run-bad-allowlist.mjs` or swap command temporarily
- Docs: [`PATCHES.md`](../../../mcp-watchdog-test/vendored/filesystem/PATCHES.md)

## Consent

User executed close-triage-gaps plan → clone/install approved for filesystem only.
