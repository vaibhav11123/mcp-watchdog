# PRIYA-OSS-LOGICS

Shallow clones under `docs/spikes/repos/` (gitignored): mcpwatch, mcp-sentinel, mcp-covenant, mcp-http-probe, mcp-schema-watch.

## Takeaways for this wave

### mcp-sentinel (ADR-0004)
- Monitor is **read-only**: `tools/list` (and discovery lists) only — **never `tools/call`**.
- Aligns with our probe-core / `detectToolDrift` (advisory, no tool invocation).

### mcpwatch
- Health + schema contract diff (`diffTools`); exit codes distinguish down vs breaking schema.
- Our `packages/probe-core` already mirrors contract diff; live retest with `detectToolDrift: true` on Exa/REA.

### mcp-covenant
- Semver-style breaking / minor / patch for MCP interface changes.
- Confirms “breaking vs non-breaking” framing for drift UX; no product change required beyond live R of B5-04.

### EH / webview (industry, not from these clones)
- Clean EH: `--disable-extensions` + `--profile-temp` (SO / VS Code docs).
- Webview race: cache last HTML; re-apply on `resolveWebviewView` + `onDidChangeVisibility` (zephyr-ide pattern).

### Host Electron (vscode-test#349)
- macOS 1.110+ binary is `Code`, not `Electron`. Fix: `@vscode/test-electron` ≥3.x CFBundleExecutable resolution.
