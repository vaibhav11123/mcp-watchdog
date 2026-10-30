# REA evidence — curriculum repos

**When:** 2026-10-30  
**Tool:** `rea-agents@6.5.0` → `rea analyze-javascript-application` (CLI)  
**Why CLI:** First MCP calls failed — broken `npx` cache missing `bridge/process/*.swift`. Fixed by `npm install -g rea-agents@6.5.0` and pointing Cursor MCP at `/Users/vaibhavsingh/.nvm/versions/node/v22.23.3/bin/rea`. **⌘Q Cursor** to load that MCP command.

## Clones (local study roots)

| Repo | Path |
|---|---|
| mcp-http-probe | [`docs/spikes/repos/mcp-http-probe`](./repos/mcp-http-probe) |
| mcpwatch | [`docs/spikes/repos/mcpwatch`](./repos/mcpwatch) |
| mcp-schema-watch | [`docs/spikes/repos/mcp-schema-watch`](./repos/mcp-schema-watch) |
| mcp-covenant (Rust) | [`docs/spikes/repos/mcp-covenant`](./repos/mcp-covenant) — **not** JS; REA JS graph N/A; study `src/diff.rs` + tests |

Raw REA JSON (large): [`docs/spikes/rea-evidence/`](./rea-evidence/)

## REA graph results (observed)

| Target | evidence_id | nodes | edges | parsed JS files | AST nodes visited |
|---|---|---:|---:|---:|---:|
| mcp-http-probe | `ev_6ec08e83435bde5ae7cecb8017f3f9abc923cec54e0cd54a996f7238c46194d8` | 53 | 65 | 5 | 4234 |
| mcpwatch | `ev_c62b289ff5ea8336725f5a6939525278b73d54a63a73dff38a6afe62c8698936` | 24 | 32 | 4 | 2099 |
| mcp-schema-watch | `ev_39ac38b5dfd797e2917eb56e846264535c2866e48f50169f38f53c6bd1da657c` | 210 | 374 | 37 | 9455 |

**Coverage:** complete (no truncation) on all three.  
**Limitations (REA):** inert parse only; no runtime; dynamic paths may stay unresolved.

### Modules REA inventoried (then opened for logic)

**mcp-http-probe:** `src/index.ts`, `src/cli.ts`, `examples/reference-server.ts`, `test/probe.test.ts`  
Evidence in source (post-graph): MUST checks implemented in `src/index.ts` — e.g. `origin-validation` → 403, `session-unknown` → 404 (`Mcp-Session-Id`), `session-delete` / 405 path, tool listing.

**mcpwatch:** `bin/mcpwatch.js`, `src/mcpClient.js`, `src/snapshot.js`  
REA graph + source: `snapshot.js` `diff`-style changes with `severity: "breaking"|"info"` — tool_removed, required_param_added, param_removed, param_type_changed = breaking; tool_added / optional param / description = info.

**mcp-schema-watch:** 37 modules including `src/diff/diffTools.ts`, `src/diff/normalize.ts`, `src/alerts/slackAlert.ts`, `src/api/servers.controller.ts`, `src/db/*`, poll path (`pollServer` references in graph text).  
`diffTools(previous, current)` is the pure function to re-derive for probe-core (MIT — re-implement rules, do not copy file wholesale without license check; both MIT).

## What this changes vs README-only spike notes

1. **Confirmed** probe check IDs live in `mcp-http-probe/src/index.ts` (not only README).  
2. **Confirmed** mcpwatch’s breaking table is ~40 lines in `src/snapshot.js`.  
3. **Confirmed** cloud shape: Nest-style modules + `diffTools` + Slack + DB repos in mcp-schema-watch.  
4. **mcp-covenant** needs Rust source study (`src/diff.rs`) — REA JS analyzer correctly skipped.

## Cursor MCP fix applied

`~/.cursor/mcp.json` `rea` server:

```json
{
  "command": "/Users/vaibhavsingh/.nvm/versions/node/v22.23.3/bin/rea",
  "args": ["mcp"]
}
```

Restart Cursor fully so Agent mode MCP uses the working binary.
