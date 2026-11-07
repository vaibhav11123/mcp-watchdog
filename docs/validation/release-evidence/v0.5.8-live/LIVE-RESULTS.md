# Live QA results — 2026-11-08 (STATUS train honesty pass)

**Commit:** `938a5ff` (docs) / product tree includes HostCaps + L7 hooks from `e0c10e3`  
**Recorder:** Cursor agent (MCP Watchdog eng)  
**Method:** TESTING.md pyramid + Live EH host suite + packaged VSIX + Overview stills  
**Not claimed:** full human F5 click-through GIF in Cursor (Computer Use blocked — needs Accessibility + Screen Recording for Cursor Computer Use)

---

## How live testing works (external + our SoT)

Industry practice for VS Code/Cursor extensions ([VS Code docs / vsce](https://code.visualstudio.com/api/working-with-extensions/publishing-extension), F5 Extension Development Host guides):

1. **F5 / `--extensionDevelopmentPath`** — new Extension Host with the extension loaded (our launch: `Run Extension (mcp-watchdog-test workspace)`).  
2. **`npm run test:host`** — same Extension Host API surface, scripted (our Live EH matrix).  
3. **`vsce package` → Install from VSIX** — what users actually get.  
4. **Capture stills/GIF** — TESTING.md + GIF-RECORDING.md.

---

## Automated results (this machine, this session)

| Layer | Command | Result |
|-------|---------|--------|
| Unit + lint + types + build | `npm run ci:local` | **PASS** — 251 unit tests |
| Smoke connect | `npm run smoke` | **PASS** — SMOKE OK |
| Extension Host Live EH | `npm run test:host` | **PASS** — **15 passing, 1 pending** |

### Live EH matrix (scripted user-mimic in EH)

| # | Scenario | Result |
|---|----------|--------|
| L1 | Empty / no folder | **skip** (empty window not available in mcp-watchdog-test EH; unit empty-state covers) |
| L2 | Trust gate blocks until approved | **PASS** |
| L3 | Healthy echo | **PASS** |
| L4–L6 | Kill echo → cause toast ≤3 → Fix QP includes causeId | **PASS** |
| L7 | Verified outcome on status after Fix verify hook | **PASS** |
| L8 | Accept quietens chip | **PASS** |
| L9 | Overview primary + overflow clamp | **PASS** |
| Alerts | Kill echo → toast Fix / Show Log / Mute | **PASS** |

No neutron-bit logic failures observed in this matrix. Pending only L1 empty-window (documented).

---

## Packaged artifact

- VSIX: [`mcp-watchdog-0.5.8-live.vsix`](./mcp-watchdog-0.5.8-live.vsix) (1.35 MB)  
- Includes `dist/extension.js`, listing copy, `bin/mcp-watchdog.mjs` scaffold, store images.

---

## What it looks like (stills)

**Not on GitHub.** PNG/GIF under `stills/` are gitignored (desktop/privacy). Keep locally if needed; see [LIVE-SCREEN-CAPTURE.md](./LIVE-SCREEN-CAPTURE.md). Overview HTML fixtures may remain as `.html` only.

---

## What we have really shipped (product truth)

| Item | Shipped to users? | Notes |
|------|-------------------|-------|
| Doctor UI (cause sentences, toast ≤3, Reconnecting) | **Yes** — 0.5.7 announce story; in VSIX | Already on registries via 0.5.7 / cadence 0.5.8 |
| HostCaps Fix honesty (omit restart when host can’t) | **On main / in this VSIX** | Silent fold — no separate announce |
| Overview `Verified:` | **On main / in this VSIX** | Announce beat still HOLD for soak + GIF |
| Phase 4–6 scaffolds | **In tree / VSIX bin stub** | CLI does **not** probe yet |
| Bake-off win / public % | **Not announced** | Evidence only |

---

## Gaps / broken / blocked

1. **Human F5 click-demo + Cursor UI screenshot via Computer Use** — blocked until Accessibility + Screen Recording enabled for Cursor Computer Use. Extension Host was launched; agent could not drive the window.  
2. **L1 empty-window** — skipped in host suite (known).  
3. **CLI** — scaffold only (`ok: false`, message says loaders not enabled).  
4. **softStop** — not wired into Overview UI yet.  
5. **0.5.9 SIGN-OFF** — remains HOLD for soak calendar + human GIF per GIF-RECORDING (not flipped READY by this pass).

---

## Ship decision for this evidence pack

**READY for confidence in Doctor/verify logic** (automated Live EH + Overview stills + VSIX).  
**HOLD for 0.5.9 announce tag** until soak window + human GIF/stills in Cursor EH (TESTING.md).
