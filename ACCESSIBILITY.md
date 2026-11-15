# Accessibility

MCP Watchdog is a VS Code / Cursor extension. Most of the UI uses the editor’s
native workbench controls (activity bar, tree, status bar, QuickPick, Output).

## Supported environments

- VS Code / Cursor (and Open VSX–compatible forks) that meet `engines.vscode`
  in `package.json`
- Editor themes and zoom levels supported by the host
- Screen readers that work with the host’s tree / QuickPick / notification APIs

## Known limitations

- The Overview **webview** is custom HTML/CSS. Keyboard focus order and ARIA
  coverage may lag the native tree; prefer the Servers tree and commands if the
  webview is hard to use.
- Status-bar text is short; detail lives in tooltips, Overview, and Output.
- We do not ship a separate high-contrast stylesheet beyond what the host theme
  provides to webviews via CSS variables.

## Reporting barriers

Open a GitHub issue with label context (platform, host version, assistive tech)
or email via the process in [SECURITY.md](./SECURITY.md) if the report must stay
private. Describe the barrier and what you expected.
