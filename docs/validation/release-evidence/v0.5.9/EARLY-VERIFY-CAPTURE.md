# Early verify capture (pre-soak) — 2026-11-08

**Intent:** Capture Fix → verify evidence **early** (before ≥3-day soak / SIGN-OFF READY).  
**Claim stage:** Still **Now+**. Does **not** flip v0.5.9 SIGN-OFF to READY (soak calendar remains).

## Method

- Cursor **Extension Development Host** (`mcp-watchdog-test`)
- AppleScript focus EH + command palette Fix Failure → Retry probe
- `screencapture` stills + ~45s MOV → ffmpeg GIF (~526 KiB)

## What landed (local only — gitignored media)

| Artifact | Notes |
|----------|--------|
| `stills/verify-l7-qp-220025.png` | Toast: **“MCP echo: fix ran but verify=unresolved …”** + flapping toast — **prove verify ran** |
| `stills/VERIFY-toast-unresolved-220025.png` | Copy of above for handoff |
| `clips/verify-l7-220025.mov` | Full EH capture |
| `clips/verify-early-demo.gif` | Compressed ≤5 MB candidate (~526 KiB) |

## Proven

- Doctor fail toast / cause path still works on echo kill.
- Fix → **verifyAfterFix** executed (unresolved because echo stayed dead — honest).
- Live EH automated L7 hook already green in host suite (`npm run test:host`).

## Still open for polished Marketplace `images/demo.gif`

1. Overview webview meta line **`Verified: unresolved` / `resolved`** in-frame (sidebar Servers tree does not show that meta; Overview HTML does).
2. Cleaner crop (status bar + Watchdog + toast only); fewer global MCP rows (L-MERGE-01).
3. Optional: Fix while echo can recover → **`Verified: resolved`** for happier story (or keep unresolved — honest).

## SIGN-OFF

Ship decision remains **HOLD** until soak (~2026-11-10 earliest) + polished GIF / Overview Verified still. This pack is **prep**, not READY.
