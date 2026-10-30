# SCREEN-MAP — Priya live UI inventory

Session: 2026-10-30. Result: `pass` | `fail` | `gap` | `blocked` | `pending`.

| id | screen | control | action | expected | result | still | gap |
|---|---|---|---|---|---|---|---|
| A1-01 | Marketplace/README | Demo GIF | Read asset | Honest placeholder or live clip | **gap** | A1-demo-gif.gif | Placeholder loop; not live kill→toast |
| A1-02 | README | Why/Install/Where UI | Read | Clear activity-bar path | **pass** | (README) | — |
| A1-03 | Walkthrough | openServersView | Click (EH) | Opens Overview/Servers | **partial** | A2-eh-frontmost | View opens; Overview copy wrong |
| A1-04 | Walkthrough | addMcpConfig | Observe | mcp.json | **pass** | A7-05 | mcp.json opened in EH |
| A1-05 | Walkthrough | showStatus | Cmd | Status/trust | **pass** | A5-02 | Routes to untrusted / trust |
| A2-01 | Activity bar | MCP Watchdog | Visible | Icon + views | **pass** | A2-eh-fresh | — |
| A2-02 | Views | Overview tab | Observe | Dashboard/untrusted | **fail** | A7-04 | Shows “Open a folder” while folder open |
| A2-03 | Views | Servers tab | Observe | Tree + approval | **pass** | A7-04 | Approval + Offline rows |
| A2-04 | Title | Refresh | Cmd | Reloads | **partial** | A2-04-refresh | Palette focus flaky |
| A2-05 | Title | Reconnect all | Cmd | Reconnect/trust | **partial** | A3-04 | Untrusted → trust prompt path |
| A2-06 | Title | Open MCP config | Observe | Config | **pass** | A7-05 | mcp.json visible |
| A3-01 | Overview | reviewTrust | Toast/status | QuickPick | **partial** | A2-eh-fresh | Toast Review & Allow seen; Overview CTA missing (wrong empty) |
| A3-02 | Overview | openConfig | — | — | **blocked** | | Wrong empty state hides intended CTAs |
| A3-03 | Overview | showOutput / View logs | Click | Output | **pass** | A3-03-view-logs | — |
| A3-04 | Overview | reconnectAll | — | — | **blocked** | | No dashboard (not trusted) |
| A3-05 | Overview | row reconnect | — | — | **blocked** | | No failed dashboard row |
| A3-06 | Overview | Recover copy | Read | Dual recover paths | **blocked** | | Dashboard not reached |
| A3-07 | Overview | Dual-truth copy | Read | IDE≠host | **blocked** | | Dashboard not reached |
| A3-08 | Overview | Metric chips | Read | Counts | **blocked** | | Dashboard not reached |
| A4-01 | Servers | Row select | Observe | Names | **pass** | A7-04 | 6 names Offline |
| A4-02 | Servers | Inline Reconnect | — | — | **blocked** | | Offline/untrusted; no healthy row |
| A4-03 | Servers | State labels | Observe | Offline / states | **partial** | A7-04 | Offline only; 5 live states not forced |
| A5-01 | Status bar | MCP: untrusted | Observe | Shield chip | **pass** | A2-eh-fresh | Distinct from Cursor MCP:3/3 |
| A5-02 | Status bar | Click | Click | Trust/status | **pass** | A5-02 / A7-05 | — |
| A6-01 | Toast | Reconnect | — | — | **blocked** | | No failure toast (monitor not started) |
| A6-02 | Toast | Show Log | — | — | **blocked** | | |
| A6-03 | Toast | Reload Window | — | — | **blocked** | | Safety / not failure-path |
| A6-04 | Toast | Quit Cursor | — | — | **blocked** | | Plan: EH only; skipped |
| A6-05 | Toast | Mute 1h | — | — | **blocked** | | |
| A6-trust | Toast | Review & Allow / Not now | Visible | Trust | **pass** (visible) | A2-eh-fresh | Accept flow incomplete in automation |
| A7-01 | Trust | Review & Allow | Click | QP | **partial** | A7-02 | Click registered; QP accept not verified |
| A7-02 | Trust | Not now | — | Defer | **blocked** | | Not clicked (wanted allow path) |
| A7-03 | Trust QP | Accept all | — | Monitor | **gap** | A7-04 | Still approval required after attempts |
| A7-04 | Trust QP | Accept none | — | Revoke | **blocked** | | |
| A8-01..10 | Palette | mcpWatchdog.* | Partial cmds | Focus/status/output/export | **partial** | A8-* | Several invoked; focus often stolen by agent window |
| A9-01 | Settings | mcpWatchdog filter | — | All rows | **blocked** | A9 identical stale | Capture stalled |
| A9-02 | Settings | Toggles | — | Apply | **blocked** | | |
| A10-01 | Cloud | Name+URL+Watch | Submit/API | Listed | **pass** | A10-01 | `priya-live` failed |
| A10-02 | Cloud | Poll | API+UI | State updates | **pass** | A10-01 | failed / fetch failed |
| A10-03 | Cloud | Dual-truth pre | Bridge POST | JSON row | **pass** | A10-03 | ide+cloud failed |
| A10-04 | Cloud | Audit pre | Policy | Events | **pass** | A10-01/03 | create/deny/allow |

Coverage: interactive Cloud 100%; IDE interactive ~55% attempted with vision; failure-toast matrix blocked by trust not completing to monitor.
