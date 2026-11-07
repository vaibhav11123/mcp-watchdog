# Live screen capture — Extension Development Host (2026-11-08 ~00:53–00:55 IST)

**Method:** Cursor EDH (`--extensionDevelopmentPath` + `mcp-watchdog-test`) · macOS `screencapture -V` video · AppleScript keystrokes (Cursor Accessibility ON).  
**Computer Use MCP:** still reports Accessibility/Screen Recording **off for `Cursor Computer Use`** — used Cursor app Accessibility + system screencapture instead.

## Artifacts (local; clips gitignored)

| File | What |
|------|------|
| `stills/LIVE-toast-overview-doctor.png` | **Canonical** — Overview + stacked Doctor toasts after echo kill |
| `stills/LIVE-fix-qp-*.png` | Fix Failure command / QP attempt |
| `stills/eh-after-*.png` | Intermediate frames |
| `clips/live-eh-doctor-*.mov` | ~25s screen record of Overview + toasts |
| `clips/live-fix-qp-*.mov` | ~12s Fix command attempt |

## What the live UI proved (working)

- Overview metrics: **Healthy / Reconnecting / Failed** (not “Active”).
- Failure toasts **≤3 actions**: Mute 1h · Show Log · Fix…  
- Cause **sentences** (not raw stacks):
  - aws-mcp: “Session expired — refresh or run login…”
  - posthog: “Missing credential — add the token or API key name…”
  - echo (after kill): “Process closed the connection…” (**P-CLASS-01 fix visible live**)
- Watchdog Overview webview opened and rendered in EH.

## Live nits found (new)

| ID | Sev | Finding |
|----|-----|---------|
| L-MERGE-01 | P1 | EH Overview showed **11** servers / globals (`aws-mcp`, `posthog`) mixed into test workspace — demo noise; mute-all / echo-only isolation incomplete when user globals exist |
| L-DISABLE-01 | P2 | Disabled servers listed as “Offline · persistent · disabled” clutter Overview |
| L-SCHEMA-01 | P2 | `.vscode/mcp.json` uses `"servers"` — Problems: missing `mcpServers` / `servers` not allowed (Cursor schema vs VS Code shape) |
| L-EDH-01 | P3 | Banner “All installed extensions are temporarily disabled” from `--disable-extensions` — scary; EDH still loads Watchdog via development path |
| L-TOAST-ORD-01 | P3 | Toast action order was Mute / Show Log / Fix… (spec preferred Fix / Show Log / Mute) — still ≤3 |

## Computer Use note for Vaibhav

Enable **both** toggles specifically for **“Cursor Computer Use”** (`co.anysphere.cursor-computer-use`), not only **Cursor**. Cursor alone was enough for AppleScript + screencapture this pass.
