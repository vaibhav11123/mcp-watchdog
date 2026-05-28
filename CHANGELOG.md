# Changelog

All notable changes to **MCP Watchdog** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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

[0.1.6]: https://github.com/vaibhav11123/mcp-watchdog/releases/tag/v0.1.6
[0.1.5]: https://github.com/vaibhav11123/mcp-watchdog/releases/tag/v0.1.5
[0.1.4]: https://github.com/vaibhav11123/mcp-watchdog/releases/tag/v0.1.4
[0.1.3]: https://github.com/vaibhav11123/mcp-watchdog/releases/tag/v0.1.3
[0.1.2]: https://github.com/vaibhav11123/mcp-watchdog/releases/tag/v0.1.2
[0.1.1]: https://github.com/vaibhav11123/mcp-watchdog/releases/tag/v0.1.1
[0.1.0]: https://github.com/vaibhav11123/mcp-watchdog/releases/tag/v0.1.0
