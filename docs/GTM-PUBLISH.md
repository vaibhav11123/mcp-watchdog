# GTM / publish / media

Audiences, platforms, media, dual publish, marketing sync. Complements [EXECUTION.md](./EXECUTION.md).

---

## A. Audiences

| Audience | Surface | Proof asset |
|---|---|---|
| Operator (PLG) | IDE (Cursor first) | Failure toast → **Accept** / **Fix…** / **Remove** / Retry probe |
| Author | Watchdog Cloud (preview) | Dual-truth bridge + Add Server dialog |
| Team / security | Configuration policy checks | Allow or deny, audit trail, outside the tool-call path |
| Self-host | OSS cloud README | T3 &lt;30 min |
| Investor | Local probe vs Cloud probe | Opt-in bridge posts names-only; dual-truth is honest |

---

## B. Platform smoke (G0) — every RC

| Platform | Channel | Pass criteria | Date / result |
|---|---|---|---|
| Cursor | Open VSX | Install → reload → activity bar → fail → Accept/Fix | _after 0.5.4 listing_ |
| VS Code | Marketplace | Same | _after 0.5.4 listing_ |
| Windsurf / VSCodium | Open VSX | Install + status bar | _after 0.5.4 listing_ |
| Airgap | GitHub `.vsix` | Install from VSIX | Release asset `v0.5.4` |
| Watchdog Cloud | Self-host | Dashboard + bridge POST | Host E2E green |

Use the platform’s real MCP config path (see README).

---

## C. Media (G1)

| Asset | Path | Status |
|---|---|---|
| Demo GIF | `images/demo.gif` | Shipped in README; re-record Accept story when ready ([GIF-RECORDING.md](./media/GIF-RECORDING.md)) |
| Cloud stills | `docs/validation/triage-evidence/stills/V-CL-*.png` | V-CL-01…04 captured |

---

## D. Marketing sync (G2) — 0.5.4

- [x] CHANGELOG.md dated `0.5.4`
- [x] README Accept/Fix/Remove + Cloud bridge + Demo GIF
- [x] package.json description + walkthrough Watchdog chip
- [x] Version `0.5.4`
- [x] Announce draft (below)

---

## E. Dual publish (G3)

Workflow: `.github/workflows/release.yml` on tag `v*`.

1. Tag `v0.5.4` → push  
2. `vsce package` → GitHub Release + `.vsix`  
3. VS Marketplace if `VSCE_PAT` set  
4. Open VSX if `OVSX_PAT` set (Cursor primary)  
5. Soft-skip if PAT empty — verify listing before claiming published  

Item: `mcp-watchdog.mcp-watchdog`.

Evidence / handoff: [validation/triage-evidence/PUBLISH-HANDOFF.md](./validation/triage-evidence/PUBLISH-HANDOFF.md).

---

## F. Watchdog Cloud story (G4)

- Opt-in `cloudBridge.enabled` posts names-only incidents including `accepted`.
- Dual-truth compares IDE bridge state with Cloud’s own poll — not the editor MCP client.
- Assets: `V-CL-*` stills in triage-evidence.

---

## G. Post-release (G5)

1. Confirm Open VSX + Marketplace show **0.5.4**  
2. Re-run G0 on **published** Cursor install (not F5)  
3. Outreach:

**X / LinkedIn (short):**  
MCP Watchdog 0.5.4 — when an MCP server fails, Accept / Fix… / Remove in one toast. Independent health for Cursor & VS Code. Opt-in Cloud bridge (names-only). Open VSX + Marketplace.

**HN / forum (longer):**  
Editor can still list tools after a server goes quiet. Watchdog runs its own probe, shows status/latency, then Accept (chip), Fix… (guided), or Remove (edit mcp.json). Retry probe ≠ Restart editor MCP. Cloud is opt-in self-host dual-truth — not a gateway.
