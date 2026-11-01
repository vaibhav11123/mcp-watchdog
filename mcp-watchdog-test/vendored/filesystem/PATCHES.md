# Vendored filesystem MCP — Watchdog patches

**Upstream:** `@modelcontextprotocol/server-filesystem@2025.11.25` (npm) + `upstream/` TypeScript from `modelcontextprotocol/servers` `src/filesystem` (HEAD sparse clone for REA/docs; engines≥24 so not the runtime DUT).

## REA findings (names only — no secrets)

- Entrypoint: `dist/index.js` (`mcp-server-filesystem` bin).
- Startup reads `process.argv` allowlist dirs; `fs.stat` / `process.exit(1)` when a path is not an accessible directory.
- Tools operate under `setAllowedDirectories` (read/write/search within allowlist).
- REA evidence parent: `ev_4dd80cc5540fae57f78044e08fad72d82a66db986006bc2fa8d7e8992b0d5d99` (local session).

## Watchdog-facing wrappers (this folder)

| Script | Behavior | Triage use |
|--------|----------|------------|
| `run-healthy.mjs` | Real server + allowlist `./sandbox` only | healthy → Accept path after kill |
| `run-bad-allowlist.mjs` | Real server + missing dir → exit 1 | spawn/failed → Fix / Remove |

No env/header secrets. Sandbox is `sandbox/` only — never `$HOME`.

## Install

```bash
cd mcp-watchdog-test/vendored/filesystem/pkg
npm ci   # or: npm install
```
