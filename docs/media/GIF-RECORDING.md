# GIF recording — Doctor failure → Fix → verify

Overwrite `images/demo.gif` (≤5 MB) only after this story is recorded. Do not caption an older Retry/Accept-heavy GIF as current Doctor UI.

See also pre-ship capture rules: [TESTING.md](../TESTING.md).

## Setup

1. F5 **Run Extension (mcp-watchdog-test)** (or clean Extension Host).
2. `mcpWatchdog.requireApproval: false`; only **echo** enabled (`perServer`).
3. Kap / CleanShot / Cmd+Shift+5 — crop status bar + Watchdog sidebar + notification. Dark theme.
4. **No secrets in frame** (no env values, no API keys, no AWS login terminal with profiles).
5. Optional: enable `cloudBridge` only if Cloud is local and you will not show raw payloads with secrets (there should be none).

## Script (~20–25s) — Doctor toast + Fix

1. **0–3s:** Overview + status chip with echo healthy (`Watchdog: 1/1` or equivalent). Metric tile label **Reconnecting** visible in chrome if shown.
2. **3–5s:** Kill echo (`pkill -f echo-server.js` or stop the process).
3. **5–10s:** Hold the failure toast. Actions ≤3: **Fix…**, **Show Log**, **Mute 1h**. Message prefers a **cause sentence**, not a raw stack.
4. **10–12s:** Overview failed row shows cause sentence + first action; quiet **Editor session: Unknown** (not raw log as headline).
5. **12–18s:** Click **Fix…** → Quick Pick titled `Fix echo (…causeId…)`; pick **Retry probe** (or restart if available) — never live aws login / Exa wizard with real keys.
6. **18–25s (0.5.9+ cuts):** After re-probe, show Overview meta **Verified: resolved** (or unresolved if still down — honest). Optional Accept via command palette is out of toast.

## Out of frame

- Live AWS terminal (`aws login`)
- Real Exa credential wizard
- Env/header values
- Toast actions beyond Fix… / Show Log / Mute 1h

After recording: replace `images/demo.gif`, embed in README Demo, note date in CHANGELOG; attach stills under `docs/validation/release-evidence/vX.Y.Z/stills/` when signing off a cut.
