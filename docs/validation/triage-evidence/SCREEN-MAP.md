# Triage visual screen-map

**Date:** 2026-11-01  
**Review lens:** Priya (IDE) / MCP author (Cloud)

## Logic (API / unit / host)

| id | Result | Evidence |
|----|--------|----------|
| L-UNIT | **pass** | `npm run test:unit` — 181/181 |
| L-TRIAGE-E2E | **pass** | `npm run triage-e2e` |
| L-COMPILE-BUILD | **pass** | `npm run compile && npm run build` |
| L-HOST-ACCEPT | **pass** | Host `acceptFailure…` |
| L-HOST-REMOVE | **pass** | Host `removeServerForTests` + `MCP_WATCHDOG_HOST_AUTOCONFIRM=1` |
| L-HOST-BRIDGE | **pass** | Host live Cloud fail→accepted |
| L-TIER3-FS | **pass** | `npm run tier3-filesystem` |
| L-SECRETS | **pass** | [SECRETS-PASS.md](./SECRETS-PASS.md) |

## IDE — Wave 1+

| id | Surface | Result | Notes |
|----|---------|--------|-------|
| V-SB-01 | Status bar N/M | **skip** | Cursor Computer Use blocked (Accessibility / Screen Recording not granted for Cursor Computer Use). Chip math: unit `statusBarModel` / `failureTriage` |
| V-TOAST-01 | Accept/Fix/Remove toast | **skip** | Same CU block; host `alerts.test.ts` asserts action strings |
| V-TREE-01 | Tree context menu | **skip** | package.json menus; commands registered in host |
| V-OV-01 | Overview Accepted badge | **pass** (logic) | `overviewHtml` `(Accepted)` |
| V-FIX-01 | Fix QuickPick | **pass** (logic) | `buildFixSteps` unit |
| V-RM-01 | Remove confirm | **pass** (logic+host) | Host Remove deletes key; modal skipped only with autoconfirm env |

## IDE — Wave 2+

| id | Result | Notes |
|----|--------|-------|
| V-TERM-01 | **skip** | Hard lock — no live AWS; unit `terminal.awsLogin` |
| V-WIZ-01 | **skip** | No live Exa/AWS wizard; synthetic unit only |
| V-AP-01 | **pass** (logic) | authProbe unit |

## Cloud — Wave 3+

| id | Result | Evidence |
|----|--------|----------|
| V-CL-01 | **pass** | `stills/V-CL-01-dashboard.png` |
| V-CL-02 | **pass** | `stills/V-CL-02-add-dialog.png` — Add server dialog |
| V-CL-03 | **pass** | `stills/V-CL-03-servers-table.png` — servers table after add |
| V-CL-04 | **pass** | `stills/V-CL-04-dual-truth-accepted.png` — bridge row `accepted: true` |

## VISION-NOTES

- Enable **Accessibility + Screen Recording** for Cursor Computer Use to capture IDE V-* stills / Accept GIF; until then IDE visuals are logic+host substitutes.
- Cloud stills via ide-browser against `http://127.0.0.1:8787`.
- Tier 3: real filesystem MCP vendored — see MCP-DISCOVERY.md (not `everything`).
