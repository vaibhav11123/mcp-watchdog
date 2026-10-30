# Visual QA — IDE (Gate 1)

Capture into `docs/media/` per [docs/media/README.md](../media/README.md).

Live Priya audit (2026-10-30): [PRIYA-FULL-AUDIT-REPORT.md](./PRIYA-FULL-AUDIT-REPORT.md) + [priya-evidence/](./priya-evidence/).

| Check | Pass? | Notes |
|---|---|---|
| Status bar healthy `MCP: n/m` | blocked | Trust never reached monitoring; saw `MCP: untrusted` |
| Status connecting / degraded / failed / disconnected | blocked | Only Offline / untrusted on screen |
| Toast shows Reconnect / Reload Window / Quit / Mute | blocked | Failure toast not reached; trust toast Review & Allow seen |
| Overview recover copy visible | fail | Overview showed “Open a folder” with folder open (P0) |
| Dual-truth note visible | blocked | Dashboard not reached |
| Bridge setting default OFF | | Not toggled in Settings UI this pass |
| No env/header values on screen | pass | No secret values observed in stills |

Screenshots owed: `docs/media/states/*.png`, `recover-cta.png`, `dual-truth.png`. Priya stills: `priya-evidence/stills/`.
