# Live E2E results (0.5.3 wave)

**Targets:** Exa + REA + echo. **xAI deferred.**

## Automated product gate (host)

`npm run test:host` (clean EH, `--disable-extensions`):

| Case | Result |
|---|---|
| Extension activates | pass |
| Commands registered | pass |
| `requireApproval` blocks until trusted | pass |
| echo → healthy ≤15s | pass |
| reconnectAll | pass |
| kill echo → alert Reconnect + Reload Window | pass |

## Live EH still (G1 / Exa+REA visibility)

Extension Development Host on `mcp-watchdog-test` + user globals:

- Status chip **`Watchdog: 1/6`** with **echo** Healthy.
- **exa**, **rea**, **aws-mcp** listed (Offline/disabled via `perServer` / not in trusted subset for GIF run).
- Still: `stills/g1b/full.png`.

## Deferred

- xAI / Grok live verify
- Quit Cursor on user’s main Cursor session
