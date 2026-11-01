# WAVE-GATES — W1 / W2 / W3 without history rewrite

**Date:** 2026-11-01  
Prove exit criteria in-place (no force-push into three wave PRs).

## W1 — Accept / chip / Remove (core)

| Criterion | Evidence | Status |
|-----------|----------|--------|
| Accept clears chip (accepted flag) | Host `acceptFailure…` + unit statusesForChip | **pass** |
| Remove deletes mcp.json key | Host `removeServerForTests` + `MCP_WATCHDOG_HOST_AUTOCONFIRM=1` | **pass** |
| Overview Accepted badge | `overviewHtml` unit | **pass** |
| No secret values in UI/logs | SECRETS-PASS | **pass** |

## W2 — Fix / recipes / authProbe / Claude Desktop

| Criterion | Evidence | Status |
|-----------|----------|--------|
| FailureClass + Fix steps | `failureTriage` unit matrix | **pass** |
| Exa/AWS recipes (synthetic only) | `vendorRecipes` + frozen strings; **no live secrets** | **pass** |
| authProbe opt-in | monitor unit | **pass** |
| Claude Desktop origin | config-core unit / TECHNICAL | **pass** |
| V-TERM live AWS | **skip** (hard lock) — unit `terminal.awsLogin` only | **skip** |

## W3 — Cloud bridge dual-truth

| Criterion | Evidence | Status |
|-----------|----------|--------|
| Opt-in POST incidents | Host `cloudBridge posts fail then accepted` against local Cloud | **pass** |
| `accepted: true` on dual-truth | Same host test + Cloud store | **pass** |
| Cloud dashboard Add Server | V-CL-01 still + markup | **pass** |
| Fail-soft when bridge off/unreachable | unit cloudBridge | **pass** |

## Tier 3 — real-value MCP

| Criterion | Evidence | Status |
|-----------|----------|--------|
| Vendored filesystem (not `everything`) | MCP-DISCOVERY + `npm run tier3-filesystem` | **pass** |
| REA on clone only | MCP-DISCOVERY / PATCHES.md | **pass** |

## Aggregate

Logic gates green. Visual IDE stills via Cursor Computer Use tracked in SCREEN-MAP (update when captured).
