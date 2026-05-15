# MCP Watchdog

VS Code / Cursor extension that runs a **parallel health layer** over MCP servers defined in **`.vscode/mcp.json`**: periodic pings, exponential backoff reconnects, and an extra check when the window regains focus (helpful after sleep).

**This does not replace** the editor’s built-in MCP integration. It opens **its own** MCP client connections **only to monitor** reachability and latency.

## Install

| Channel | Steps |
|--------|--------|
| **Marketplace** | Search **“MCP Watchdog”** (after you publish) or open `https://marketplace.visualstudio.com/items?itemName=<publisher>.mcp-watchdog`. |
| **VSIX** | Download `mcp-watchdog-0.1.0.vsix`, then **Extensions** → **⋯** → **Install from VSIX…**, or run `code --install-extension mcp-watchdog-0.1.0.vsix` / `cursor --install-extension mcp-watchdog-0.1.0.vsix`. |

After install, **reload** the window if commands or views do not appear.

## Requirements

- **VS Code** or **Cursor** with a compatible engine: this manifest declares **`engines.vscode`: `^1.105.0`** (adjust if you need a different floor after testing).
- A **workspace folder** that contains **`.vscode/mcp.json`** with a top-level **`servers`** object (same shape VS Code uses for MCP).
- In **multi-root** workspaces, only the **first** folder is used when resolving **`mcp.json`** and **`${workspaceFolder}`**.

## Quick start

1. Add `.vscode/mcp.json` (see example below). You may use **`${workspaceFolder}`** in `args`, `cwd`, `env` values, and URLs — MCP Watchdog expands it like VS Code.
2. Open that folder. **MCP Watchdog** shows in the **activity bar** → **Servers**; the **status bar** shows **`MCP: n/n`**.
3. Optional: **View → Output → MCP Watchdog** for detailed logs.

### Example `mcp.json`

```json
{
  "servers": {
    "memory": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    },
    "remote": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer YOUR_TOKEN" }
    }
  }
}
```

**Security:** only configure servers you trust. This extension runs **`command`** (e.g. `npx`, `node`) and opens **HTTP(S)** URLs you specify.

## Commands

- **MCP Watchdog: Show Server Status** — Quick pick with per-server state.
- **MCP Watchdog: Reconnect All Servers**
- **MCP Watchdog: Reconnect Server…**
- **MCP Watchdog: Open Servers View** — Focus the **Servers** tree.

## Settings (`mcpWatchdog.*`)

| Setting | Default | Description |
|---------|---------|-------------|
| `pingIntervalMs` | `30000` | Ping cadence (ms). |
| `maxRetries` | `5` | Max reconnect attempts before marking failed. |
| `initialBackoffMs` | `1000` | First backoff after failure (ms). |
| `backoffMultiplier` | `1.5` | Backoff multiplier. |
| `maxBackoffMs` | `30000` | Backoff cap (ms). |

Changes apply on **reload** or when **`mcp.json`** is reloaded; live settings refresh without reload is not implemented yet.

## Privacy & data

- **No** bundled analytics or telemetry from this extension.
- Traffic goes to **your configured** MCP servers only (stdio child processes and HTTP clients you define in `mcp.json`).
- Do **not** commit secrets inside `mcp.json` in shared repos; use environment variables or secret stores appropriate to your team.

## Known limitations

- **Workspace `mcp.json` only** (first root folder). User-global MCP config paths are not read.
- **Independent of the editor’s MCP UI**: native MCP may show different state until the next Watchdog ping.
- **HTTP transport** may combine SDK-level reconnection with Watchdog-level retries.
- **Malformed `mcp.json`**: invalid JSON shows an error notification; fix the file and save.

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| No **MCP Watchdog** in Output / no status | Folder open? **`.vscode/mcp.json`** present? Try **Developer: Show Running Extensions** → **MCP Watchdog** activated. |
| **No servers** / **0/n** | `servers` key missing or empty; path is wrong root in multi-root. |
| **Connecting** forever | `npx`/network blocked; stdio command wrong; HTTP URL/firewall. |
| `Ping failed: Not connected` then retry | Expected after killing a server or network blip; Watchdog should reconnect within your backoff settings. |

**Screenshots for the Marketplace:** capture the **status bar** (`MCP: 2/2`) and the **Servers** view; add images under `docs/` or your repo and link them here in Markdown.

## Development

```bash
npm install
npm run compile
npm run build
```

- **Run Extension** / **Run Extension (mcp-watchdog-test workspace)** from `.vscode/launch.json`.
- Fixture: `mcp-watchdog-test/` (optional; not shipped in VSIX).
- Headless smoke: `npm run smoke`.

See [CHANGELOG.md](./CHANGELOG.md).

## Ship checklist (maintainers)

1. **`publisher`** — Replace `local-mcp-watchdog` with your [Marketplace publisher](https://marketplace.visualstudio.com/manage) id.
2. **`repository` / `bugs` / `homepage`** — Update in `package.json` if you publish under a different GitHub org or repo name.
3. **`version`** — Bump per semver; summarize in `CHANGELOG.md`.
4. **README** — Screenshots, confirm engine range matches lowest editor you support.
5. **Publish** — `npx @vscode/vsce login <publisher>` then `npx @vscode/vsce publish` (after `npm run build`).

```bash
npm run build
npx @vscode/vsce package
# install locally to verify
cursor --install-extension mcp-watchdog-<version>.vsix
```

## License

MIT — see [LICENSE](./LICENSE).
