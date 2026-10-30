# GTM / publish / media

Audiences, platforms, media, dual publish, marketing sync. Complements [EXECUTION.md](./EXECUTION.md).

---

## A. Audiences

| Audience | Surface | Proof asset |
|---|---|---|
| Operator (PLG) | IDE (Cursor first) | Live GIF kill→toast→Reconnect |
| Author | Watchdog Cloud monitor | Dashboard + Slack on down/breaking drift |
| Team / security | Policy/trust plane | Deny unpinned `npx -y` + audit export |
| Self-host | OSS cloud README | T3 &lt;30 min |
| Investor | Dual-truth story | IDE vs cloud mismatch screenshot |

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
| Demo GIF | `images/demo.gif` | **Shipped:** live EH Watchdog UI + kill→toast story (≤5 MB); re-record if UI changes before major announce |
| Demo MP4 | `docs/media/demo-x.mp4` | From same master |
| State sprites ×5 | `docs/media/states/*.png` | See brand kit |
| Recover CTA | `docs/media/recover-cta.png` | After E6 |
| Dual-truth | `docs/media/dual-truth.png` | After E6/E7 |
| Cloud dashboard | `docs/media/cloud-dashboard.png` | After E7 |
| Schema breaking | `docs/media/schema-breaking.png` | After E7 |
| Architecture | `docs/media/architecture.png` | Export from EXECUTION mermaid |

**G1 human gate (0.5.3):** GIF + MP4 updated; README placeholder note removed. Optional Kap/CleanShot re-record for pure native toast footage before HN/X.

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

- Copy: monitor + **policy/trust plane** (not “gateway”)
- Assets: dashboard, Slack, dual-truth, T3 proof
- Paid: hosted convenience later (see [PAID-BOUNDARY.md](./PAID-BOUNDARY.md))

---

## G. Post-release (G5)

1. Confirm Open VSX + Marketplace show new version  
2. Re-run G0 on **published** Cursor install (not F5)  
3. Optional outreach drafts:

### Announce draft slots

**X / LinkedIn (short):**  
MCP Watchdog: know when MCP is actually dead — status bar + one-click Reconnect in Cursor/VS Code. Open VSX + Marketplace.

**HN / forum (longer):**  
Show: problem (silent MCP death) → kill demo → honest scope (parallel probe, not Cursor auto-heal) → install links → ask for feedback.

Do not spam; respect [validation/OUTREACH.md](./validation/OUTREACH.md).
