# Recruiting & outreach kit

**Goal:** Book Mom Test calls (V1) and install cohort (V2). Help first; ask second.

## Target threads (operator pain)

| Thread | Theme | Recruit angle |
|---|---|---|
| https://forum.cursor.com/t/mcp-auto-reconnect-after-server-disconnection/135368 | Auto-reconnect | Empathize; ask 20 min about last disconnect |
| https://forum.cursor.com/t/better-resilience-for-mcp-services/150510 | Resilience + visibility | Same |
| https://forum.cursor.com/t/cursor-mcp-client-fails-to-reconnect-after-network-drop-or-sleep-wake-cycle/151578 | Sleep/network silent | Same |
| https://forum.cursor.com/t/mcp-servers-disconnect-repeatedly-not-connected-error/149353 | Full restart only | Same |
| https://forum.cursor.com/t/improve-mcp-connection-persistence-visibility/146780 | Visibility | Same |
| https://forum.cursor.com/t/mcp-server-regression-does-not-reload-tools-disconnect-does-nothing-ignores-mcp-json-changes-etc/166216 | Reload insufficient | Same |
| https://github.com/anthropics/claude-code/issues/15232 | Claude reconnect | Same (Claude Code ICP) |
| https://github.com/cursor/cursor/issues/3994 | Not connected | Same |

ROS deepen: `market-research/runs/mcp-watchdog-operator-pain/`.

## Forum reply template (public)

```text
Sorry you're hitting this — Cursor staff often suggest toggle off/on or Reload Window / full quit, and it still burns time when it happens silently.

I'm researching how often this hits people who run 2+ MCPs (not selling on this thread). If you're open to a 20-minute call about the last time it happened — what you noticed, what you did — reply or DM. Happy to share notes back with the thread later.
```

## DM / calendar ask

```text
Thanks for posting on [thread]. I'm validating whether a small Cursor extension that surfaces MCP health + one-click Reload/Reconnect is actually useful when auto-reconnect isn't available yet.

20 minutes: walk through your last disconnect only. No pitch deck. [calendar link]
```

## Install cohort invite (V2)

```text
If you already feel this pain: install MCP Watchdog from Open VSX ("MCP Watchdog"), use it a week, and reply after the next real disconnect: did you see the toast? Did Reload/Reconnect help? Dual-truth: Watchdog ≠ Cursor's own MCP client status.
```

## Buyer outreach (V3 — after Gate B)

```text
Researching how eng/platform/security teams handle shadow MCP (npx -y, unpinned servers) and whether a Teams allowlist + approval audit would matter.

15 minutes: last scare or policy gap. Then a one-pager mock — yes/no on design partner or LOI next step only.
```
