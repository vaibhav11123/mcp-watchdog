# Changelog

All notable changes to **MCP Watchdog** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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

[0.1.1]: https://github.com/vaibhav11123/mcp-watchdog/releases/tag/v0.1.1
[0.1.0]: https://github.com/vaibhav11123/mcp-watchdog/releases/tag/v0.1.0
