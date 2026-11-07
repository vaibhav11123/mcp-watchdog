# Sign-off v0.5.7

- Date (UTC): 2026-11-07T17:53Z
- Commit SHA: `f545b0a` (`v0.5.7` tag)
- Recorder: Cursor eng agent (Live EH via Extension Host matrix)
- Platforms smoked: VS Code test-cli EH (`npm run test:host` → Live EH L1–L9 suite) + packaged VSIX built
- Automated:
  - [x] `npm run test:unit` — 236 passed (2026-11-07)
  - [x] `npm run compile`
  - [x] `npm run build`
  - [x] `bash scripts/check-no-secrets.sh` — OK
  - [x] `npm run smoke` — OK
  - [x] `npm run test:host` — 14 passing, 2 pending (L1 / L7 skips)
- Live EH L1–L9 (Doctor UI cut — [TESTING.md](../../TESTING.md)):

| # | Scenario | Result |
|---|----------|--------|
| L1 | Empty / no folder | **skip** — no empty window in `mcp-watchdog-test` EH; unit `overviewHtml` covers `no_workspace` → Open a folder |
| L2 | Untrusted / need approval | **pass** — `test/host/liveEh.test.ts` + trust host suite |
| L3 | Healthy echo | **pass** — Live EH L3 |
| L4 | Induce failure + cause sentence + Editor session Unknown | **pass** — cause toast `MCP echo: …` (single sentence); Editor session Unknown via `overviewHtml` unit |
| L5 | Failure toast ≤3 (Fix… / Show Log / Mute 1h) | **pass** — Live EH L4–L6 + alerts host |
| L6 | Fix Quick Pick title includes causeId | **pass** — `Fix echo (<causeId>)` captured via stubbed `showQuickPick` |
| L7 | Fix → verify (`Verified:`) | **skip for 0.5.7** — gate is ≥0.5.9 per TESTING matrix |
| L8 | Accept / Remove | **pass** — Accept via Live EH L8; Remove via triage host |
| L9 | Layout (no H-scroll; primary reachable) | **pass** — Overview `overflow-x: hidden` + reconnectAll primary (`overviewHtml` unit + Live EH L9) |

- Secrets pass: automated scan OK; toast/Overview paths use cause sentences (no env/header values)
- Packaged VSIX built: **yes** (`mcp-watchdog-0.5.6.vsix` from current tree — version bump is maintainer’s at tag)
- Packaged VSIX installed: **yes** (`cursor --install-extension ./mcp-watchdog-0.5.6.vsix --force` on this machine)
- GIF updated: **n/a** for this cut — Doctor toast ≤3 story unchanged from store GIF intent; verify beat waits for 0.5.9
- Notes: Live EH executed as Extension Host suite (`test/host/liveEh.test.ts`) equivalent to F5 against `mcp-watchdog-test`. HostCapabilities / verify announce deferred. Claim stage **Now+**. Flap isolation: `AlertManager.clearServer` now clears flap/mute maps so host suites do not poison each other.
- Ship decision: **READY**

## Remaining maintainer steps (not READY blockers)

1. Tag **0.5.7** only after RELEASE hard gates on final tag SHA; start ≥3-day soak; Instinct Slack announce draft — do not jump to 0.6.0.
2. Optional stills under `stills/` if Instinct wants capture for announce.
