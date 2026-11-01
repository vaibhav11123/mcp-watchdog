# GTM / publish / media

Audiences, platforms, media, dual publish, marketing sync. Complements [EXECUTION.md](./EXECUTION.md).

---

## A. Audiences

| Audience | Surface | Proof asset |
|---|---|---|
| Operator (PLG) | IDE (Cursor first) | Live clip: server stop, Watchdog result, Retry probe, then Restart editor MCP |
| Author | Watchdog Cloud (preview) | Remote health + schema change alerts |
| Team / security | Configuration policy checks | Allow or deny, with an audit trail, outside the tool-call path |
| Self-host | OSS cloud README | T3 &lt;30 min |
| Investor | Local probe vs Cloud probe | Do not claim the extension already posts or correlates the two |

Do **not** market cloud before Gate −1 + E7 demoable.

---

## B. Platform smoke (G0) — every RC

| Platform | Channel | Pass criteria | Date / result |
|---|---|---|---|
| Cursor | Open VSX | Install → reload → activity bar → 1 healthy → kill → toast | _pending_ |
| VS Code | Marketplace | Same | _pending_ |
| Windsurf / VSCodium | Open VSX | Install + status bar | _pending_ |
| Airgap | GitHub `.vsix` | Install from VSIX | _pending_ |
| Watchdog Cloud | Self-host | T3 + dashboard | _pending_ (after E7) |

Use the platform’s real MCP config path (see README).

---

## C. Media (G1)

Script: [launch/GIF-RECORDING.md](../launch/GIF-RECORDING.md) (repo-local; may be gitignored — keep a copy under `docs/media/GIF-RECORDING.md`).

| Asset | Path | Status |
|---|---|---|
| Demo GIF | `images/demo.gif` | **Not shipped.** Record [GIF-RECORDING.md](./media/GIF-RECORDING.md) before announce. Do not publish the old Reconnect asset as live. |
| Demo MP4 | `docs/media/demo-x.mp4` | From same master |
| State sprites ×5 | `docs/media/states/*.png` | See brand kit |
| Recover CTA | `docs/media/recover-cta.png` | After E6 |
| Dual-truth | `docs/media/dual-truth.png` | After E6/E7 |
| Cloud dashboard | `docs/media/cloud-dashboard.png` | After E7 |
| Schema breaking | `docs/media/schema-breaking.png` | After E7 |
| Architecture | `docs/media/architecture.png` | Export from EXECUTION mermaid |

**G1 human gate:** record the shot list in [docs/media/GIF-RECORDING.md](./media/GIF-RECORDING.md) (stop, Watchdog result, Retry probe, then Restart editor MCP as a different action). README does not embed a GIF until that clip exists.

---

## D. Marketing sync (G2) — every release

- [x] CHANGELOG.md entry
- [x] README Why / Demo / Install / honest scope
- [x] package.json description + keywords + gallery images
- [x] Open VSX + Marketplace one-liner match README
- [x] Version bumped for this wave (`0.5.3`)
- [ ] Announce draft (below) if public release

---

## E. Dual publish (G3)

Workflow: `.github/workflows/release.yml`

1. Maintainer tags / triggers release  
2. `vsce package` → GitHub Release + `.vsix`  
3. VS Marketplace if `VSCE_PAT` set  
4. Open VSX if `OVSX_PAT` set (Cursor primary)  
5. Soft-skip if PAT empty — do not claim published without verifying listing version  

Item: `mcp-watchdog.mcp-watchdog`.

---

## F. Watchdog Cloud story (G4) — after E7

- Public copy: remote health checks, schema change alerts, and configuration policy checks with an audit trail. Preview. Not a gateway. Decisions sit outside the tool-call path.
- Do not say the extension already correlates a local probe with a Cloud probe.
- Assets: dashboard, Slack, T3 proof. A dual-probe screenshot waits until the extension posts.
- Paid: hosted convenience later (see [PAID-BOUNDARY.md](./PAID-BOUNDARY.md))

---

## G. Post-release (G5)

1. Confirm Open VSX + Marketplace show new version  
2. Re-run G0 on **published** Cursor install (not F5)  
3. Optional outreach drafts:

### Announce draft slots

**X / LinkedIn (short):**  
MCP Watchdog: know which MCP servers are responding. Independent health checks for Cursor and VS Code. Open VSX + Marketplace.

**HN / forum (longer):**  
Show: the editor can still list tools after the server goes quiet → Watchdog’s own probe, status, and failure detail → Retry probe and Restart editor MCP are different actions → install links → ask whether that listing language matches the failure they hit. Do not claim Cloud correlation or a market size.

Do not spam; respect [validation/OUTREACH.md](./validation/OUTREACH.md).
