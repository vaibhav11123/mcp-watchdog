# Listing draft — 0.5.7

**Status:** **Applied** (2026-11-08) to `package.json` description, README lead, walkthrough `statusBar`.  
**Claim stage:** **Now+**  
**Do not ship in this file:** bake-off win, diagnose%, resolve%, auto-heal, or “host is healthy” while the editor session is Unknown.  
**Sign-off:** [v0.5.7/SIGN-OFF.md](../validation/release-evidence/v0.5.7/SIGN-OFF.md) is **READY**. Cadence may show **0.5.8+** on registries; Doctor UI **announce** story remains **0.5.7**.

---

## 1. Store `description` (applied)

```text
Know which MCP servers are responding in Cursor and VS Code. Green is Watchdog's own connection, not the editor session.
```

## 2. README headline (applied)

```markdown
**Know which MCP servers are responding — independent of what the editor still shows.**
```

## 3. Walkthrough status-bar step (applied)

```markdown
When servers are monitored, the bottom-right status bar shows **Watchdog: healthy/total**. That count is Watchdog’s own connection, not the editor’s MCP session.

[Show server status](command:mcpWatchdog.showStatus)
```
