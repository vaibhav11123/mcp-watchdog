# Spike R2 — Breaking vs non-breaking schema diff

**Status:** researched (2026-10-30)  
**Best logic tables:** [mcp-covenant](https://github.com/studiomeyer-io/mcp-covenant), [mcpwatch](https://github.com/ClaudefoustCEO/mcpwatch)  
**Closest to our cloud shape:** [mcp-schema-watch](https://github.com/DIYA73/mcp-schema-watch) (Postgres + BullMQ poller + Slack)  
**Also:** [mcp-contracts](https://github.com/mcp-contracts/mcp-contracts), [samlader/mcpdiff](https://github.com/samlader/mcpdiff), [mcp-sentinel](https://github.com/Wannavf/mcp-sentinel)

## Gap today

Watchdog `computeToolsFingerprint` is **name-only** (sorted tool names). Adding a required param does not set `toolDrift`. Plan: pure `diffTools` in probe-core with golden fixtures.

## Direction-aware matrix (from mcp-covenant)

Same structural change has **opposite** severity for input (caller sends) vs output (caller receives):

| Change | Input (caller sends) | Output (caller receives) |
|---|---|---|
| Tool / resource / prompt removed | **breaking** | — |
| New tool / resource / prompt | minor | — |
| New **required** field | **breaking** | minor (stronger guarantee) |
| New optional field | minor | minor |
| Field removed | breaking if was required, else minor | **breaking** |
| Optional → required | **breaking** | minor |
| Required → optional | minor | **breaking** (may be absent) |
| Type narrowed | **breaking** | minor |
| Enum value added | minor | **breaking** (unknown value) |
| Enum value removed | **breaking** | minor |
| Array gains `items` schema | **breaking** | minor |
| Array drops `items` | minor | **breaking** |
| `additionalProperties: true → false` | **breaking** | — |
| Description / title | patch | patch |

## Minimal rule table (mcpwatch — CLI exit codes)

Breaking: tool removed · new required param · param removed · param type changed.  
Non-breaking: new tool · new optional param · description tweak.  
Exit: `0` ok, `1` down, `2` **breaking**.

Use mcpwatch as the **smallest** teaching set; use covenant for the **full** matrix (especially output-side).

## mcp-schema-watch service shape (copy ERD ideas, re-implement)

| Piece | Role |
|---|---|
| `diffTools` pure function | breaking vs info |
| Order-independent snapshot hash | reorder ≠ drift |
| Postgres: `watched_servers`, `schema_snapshots`, `schema_diffs`, `poll_failures` | persistence |
| BullMQ repeatable job per server | poll; skip write if hash unchanged |
| Slack only on `severity: "breaking"` | no page on optional add |
| REST CRUD + `poll-now` + diff history | API for dashboard later |

Their input-side table (simplified vs covenant):

| Change | Severity |
|---|---|
| Tool removed | breaking |
| Tool added | info |
| Description changed | info |
| New required input | breaking |
| New optional input | info |
| Input param removed | breaking |
| Input type change | breaking |
| Optional → required | breaking |
| Required → optional | info |
| Output schema add/remove | info |
| Output param added | info |
| Output param removed | breaking |
| Output type change | breaking |

## Probe-core classifier (locked for T1 — logic audit)

**Authority:** mcp-covenant `src/diff.rs`. Do **not** copy mcpwatch (optional remove = breaking) or mcp-schema-watch (outputSchema remove = info).

| Change | Severity |
|---|---|
| Tool removed; input required add / optional→required; input **required** remove | breaking |
| Tool added; input optional add / required→optional; input **optional** remove | info |
| Input type narrow / enum remove / enum constraint add / `additionalProperties` true→false | breaking |
| Input type widen / enum add / enum drop | info |
| Output property remove; whole outputSchema remove; type widen; enum add; enum drop; required→optional | breaking |
| Output property/schema add; type narrow; enum remove; optional→required | info |
| Description / title | patch |
| Tools reordered only | no diff |

**Canonicalization:** sort tools by name; sort `required`; type **sets**; recurse properties (absent `properties` = empty map).

**Alert policy (cloud):** Slack/webhook only on **breaking**; store all diffs.

## Golden fixtures (≥20) — outline

Place under `packages/probe-core/fixtures/schema/` (when extracted):

- remove tool / add tool  
- add required / add optional  
- remove param / change type string→number  
- optional→required / required→optional  
- enum add / enum remove (input + output)  
- nested property required added  
- tools reordered only → hash stable, no diff  
- description-only → patch  
- outputSchema field removed → breaking  
- empty tools → empty tools (no false break)

Re-derive cases from covenant/mcpwatch tables; **do not** copy their source files verbatim. Cite READMEs in fixture headers. All MIT-aware.

## Decisions locked

- Diff engine lives in **probe-core** (pure, no network) — IDE and cloud both import it.  
- Name-only fingerprint remains for fast IDE toast until schema hash is wired; dual signal: names for “tools appeared/disappeared,” schema for contract.  
- Cloud MVP ERD starts from mcp-schema-watch table names (adapt to our naming).

## Next code action

Implement `diffTools(before, after) → { breaking[], info[], patch[] }` + 20 golden tests before any Postgres poller.

## REA evidence (repos)

| Repo | REA | Confirmed implementation |
|---|---|---|
| mcpwatch | `ev_c62b289…` — 24 nodes; modules `src/snapshot.js`, `src/mcpClient.js` | Breaking rules in `snapshot.js` (~tool_removed / required_param_added / param_removed / type change) |
| mcp-schema-watch | `ev_39ac38b5…` — 210 nodes / 374 edges; 37 JS modules | `src/diff/diffTools.ts` + `normalize.ts`; Slack + API + DB module graph |
| mcp-covenant | Rust — JS analyzer N/A | Study `src/diff.rs` + `tests/diff_*.rs` in clone |

Details: [REA-EVIDENCE.md](./REA-EVIDENCE.md)
