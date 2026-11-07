# Screen spec — Doctor UI contract

**Status:** Agent-executable SoT for IDE surfaces (2026-11-07).  
**Product SoT:** [STRATEGY-THESIS.md](../STRATEGY-THESIS.md).  
**System SoT:** [TECHNICAL-ARCHITECTURE.md](../TECHNICAL-ARCHITECTURE.md).  
**Logic SoT:** [CAUSE-CATALOG.md](./CAUSE-CATALOG.md).  
**Host UX:** [VS Code UX guidelines](https://code.visualstudio.com/api/ux-guidelines/overview) (notifications, status bar, views, webviews).

## Goal

Define how Doctor looks and what exact copy an agent may ship — without inventing a second product or a custom design system.

## Out of scope

- Cloud dashboard / CLI.  
- New webview wizards or Marketplace art inside the sidebar.  
- Figma / brand book.

## Moments (journey)

| Moment | Question | Primary surface | Primary action |
|--------|----------|-----------------|----------------|
| Notice | Something broke? | Status bar / toast | Open Overview or Fix |
| Understand | Why? | Overview row / Fix title | Read cause sentence |
| Act | Least disruptive next step? | Fix Quick Pick or row button | First recommended action |
| Verify | Did it recover? | Same row after re-probe | Show resolved / unresolved / worsened / unknown |

---

## Design language (constraints)

- **Tokens:** only `--vscode-*` and existing `stateLabels` theme colors. No custom palette, gradient, glass, or emoji.  
- **Icons:** codicons from [`src/ui/stateLabels.ts`](../../src/ui/stateLabels.ts) + shield for untrusted ([`UNTRUSTED_PRESENTATION`](../../src/ui/statePresentation.ts)).  
- **Type:** `var(--vscode-font-family)` / font-size. No second typeface.  
- **Motion:** spin only on Connecting (`sync~spin`); honor `prefers-reduced-motion` (already in Overview CSS).  
- **Illustration:** Marketplace / README only — one fail→cause→fix→verified clip ([GIF-RECORDING.md](../media/GIF-RECORDING.md)). Sidebar graphic: latency sparkline only. No empty-state scene art this pass.  
- **Density:** keep Overview padding ~12px / 8px gaps / 6px radius. Glance UI: short names; ≤3 actions on a tree item ([VS Code views](https://code.visualstudio.com/api/ux-guidelines/views)).

### Host UX rules

| Surface | Rule |
|---------|------|
| Notifications | Respect attention; one meaningful toast at a time; mute / do-not-show-again where product already has Mute; **≤3 actions** on failure toasts after this workstream; no promo toasts ([notifications](https://code.visualstudio.com/api/ux-guidelines/notifications/)) |
| Status bar | Short text; severity backgrounds only via `statusBarItem.*Background`; clear metaphors ([status bar](https://code.visualstudio.com/api/ux-guidelines/status-bar/)) |
| Webview | Fully themeable; no unrelated promo; contrast via theme tokens; buttons keep `data-action` for keyboard click ([webviews](https://code.visualstudio.com/api/ux-guidelines/webviews)) |

### AS-IS visual anchors (preserve chrome, do not redesign)

- Untrusted / Offline tree: [docs/validation/priya-evidence/stills/A7-04-trusted-monitoring.png](../validation/priya-evidence/stills/A7-04-trusted-monitoring.png) (or nearest A7-04 still).  
- Status untrusted: [docs/validation/priya-evidence/stills/A2-eh-fresh.png](../validation/priya-evidence/stills/A2-eh-fresh.png).

---

## Do not invent

- No sixth UI state for auth.  
- No Overview “Doctor panel” or modal wizard webview.  
- No second typeface, mascot, or hero illustration in the sidebar.  
- No hard-coded hex colors.  
- No rendering secret / env / header **values** (names OK).  
- No new surfaces outside status bar, Servers tree, Overview, toast, existing Fix Quick Pick.  
- No Cloud or CLI UI in this workstream.  
- No raw `lastError` as the Overview failed-row headline once TO-BE lands.

---

## Copy tables

### Status bar ([`statusBarModel.ts`](../../src/ui/statusBarModel.ts))

| State | Text (keep unless noted) |
|-------|---------------------------|
| Untrusted | `$(shield) Watchdog: untrusted` |
| Empty | `$(circle-slash) Watchdog` |
| All healthy | `$(check) Watchdog: {n}/{n}` |
| Any failed | `$(error) Watchdog: {healthy}/{total}` |
| Connecting / degraded | `$(sync~spin) Watchdog: {healthy}/{total}` |
| Else offline-ish | `$(circle-slash) Watchdog: {healthy}/{total}` |

Tooltip keeps reachability disclaimer. TO-BE: prefer cause sentence over raw `Error: {lastError}` when a diagnosis exists (S-STATUS-01).

### State words ([`stateLabels.ts`](../../src/ui/stateLabels.ts))

| State | Label | Icon |
|-------|-------|------|
| healthy | Healthy | check |
| connecting | Connecting | sync~spin |
| degraded | Retrying | warning |
| failed | Failed | error |
| disconnected | Offline | circle-slash |

### Cause sentences

See [CAUSE-CATALOG.md](./CAUSE-CATALOG.md) “Cause sentence map”.

### Overview metric tiles ([`overviewHtml.ts`](../../src/ui/overviewHtml.ts))

| AS-IS label | TO-BE label |
|-------------|-------------|
| Healthy | Healthy |
| Active | Reconnecting |
| Failed | Failed |

---

## Per-surface rows

### S-STATUS-01 — status bar failed tooltip

| Field | Value |
|-------|--------|
| **File** | `src/ui/statusBarModel.ts` |
| **AS-IS** | Tooltip may append `Error: {lastError}` raw |
| **TO-BE** | When diagnosis known: one cause sentence from catalog; raw error only in Output |
| **Anti-pattern** | Dumping full `failureContext` in the status tooltip |
| **Acceptance** | Given failed server with `auth.missing` diagnosis, when status model builds, then tooltip contains catalog sentence and does not require secret values |
| **Test** | Intended: `test/unit/statusBarModel.test.ts` › `failed tooltip uses cause sentence` — **untested** |

### S-TREE-01 — Servers tree description

| Field | Value |
|-------|--------|
| **File** | `src/serversTree.ts`, `src/ui/statePresentation.ts` |
| **AS-IS** | `{Label} · {ping}` via `formatTreeDescription` |
| **TO-BE** | Keep; ≤3 inline/context actions; no sixth state |
| **Anti-pattern** | Tree item as a button that fires Fix without selection |
| **Acceptance** | Given failed server, when tree renders, then description includes state label; actions ≤3 |
| **Test** | Existing presentation units if present; else Extension Host — **partial** |

### S-TOAST-01 — failure toast action cap

| Field | Value |
|-------|--------|
| **File** | `src/alerts.ts` (`FAILURE_ALERT_ACTIONS`), toast wiring in `extension.ts` |
| **AS-IS** | Eight actions: Accept, Fix…, Remove, Retry probe, Show Log, Reload Window, Quit Cursor, Mute 1h |
| **TO-BE** | At most **three** primary toast actions. Default set: `Fix…`, `Show Log`, `Mute 1h`. Accept / Remove / Retry / Reload / Quit remain available from Overview, command palette, or Fix Quick Pick — **not** all on the toast |
| **Anti-pattern** | Promo toast; repeating the same failure toast while muted |
| **Acceptance** | Given healthy→failed transition, when alert fires, then `actions.length ≤ 3` and Mute still works |
| **Test** | Intended: `test/unit/alerts.test.ts` › `failure toast ≤3 actions` — **untested** (update existing alerts tests) |

### S-TOAST-02 — toast message prefers cause

| Field | Value |
|-------|--------|
| **File** | Alert emit path (where message string is built) |
| **AS-IS** | `MCP server {name} failed: {lastError}` |
| **TO-BE** | `MCP server {name} failed — {cause sentence}` when diagnosis available; else keep short lastError without secrets |
| **Acceptance** | Given auth.missing diagnosis, when toast shows, then message includes “Missing credential” (or exact catalog sentence) |
| **Test** | Intended with S-TOAST-01 — **untested** |

### S-OVERVIEW-EMPTY-01 — empty / config reasons

| Field | Value |
|-------|--------|
| **File** | `src/ui/overviewHtml.ts` `renderEmptyState` |
| **AS-IS** | Four reasons: no folder / no config / empty servers / ok-but-none-monitored; one primary + View logs |
| **TO-BE** | Keep four reasons and primary CTAs; no illustration |
| **Anti-pattern** | “Open a folder” when `untrusted` |
| **Acceptance** | Existing overviewHtml tests must keep passing |
| **Test** | `overviewHtml` suite — **covered** |

### S-OVERVIEW-UNTRUSTED-01

| Field | Value |
|-------|--------|
| **File** | `renderUntrustedState` |
| **AS-IS** | Approval copy + Review & allow + MCP config |
| **TO-BE** | Keep; one primary button (Review & allow) |
| **Acceptance** | Never show Open a folder while untrusted |
| **Test** | **covered** in `overviewHtml.test.ts` |

### S-OVERVIEW-FAILED-01 — failed row Doctor line

| Field | Value |
|-------|--------|
| **File** | `src/ui/overviewHtml.ts` `renderDashboard` |
| **AS-IS** | Dot + name + state/ping meta + raw `server-error` from `lastError` + optional `<pre>` failureContext + “Retry probe” link |
| **TO-BE** | Name + state word + **one cause sentence** + **first** recommend action only (label from `recommendActions`); host unknown → quiet second line `Editor session: Unknown`; no raw error as headline; failureContext not in row (use Logs) |
| **Anti-pattern** | Three CTAs on one row; printing env values |
| **Acceptance** | Given snapshot with failed server + causeId `auth.missing`, when `renderOverviewBody`, then body matches cause sentence and first action label, and does not put full lastError in `.server-error` as headline |
| **Test** | Intended: `overviewHtml` › `failed row shows cause sentence and first action` — **untested** |

### S-OVERVIEW-METRIC-01 — rename Active

| Field | Value |
|-------|--------|
| **File** | `renderDashboard` metrics |
| **AS-IS** | Tile label `Active` for connecting+degraded count |
| **TO-BE** | Tile label `Reconnecting` |
| **Acceptance** | Body matches `Reconnecting` and not a lone `Active` metric label |
| **Test** | Intended with S-OVERVIEW-FAILED-01 or dedicated assert — **untested** |

### S-OVERVIEW-FOOTER-01 — drop essays

| Field | Value |
|-------|--------|
| **File** | `renderDashboard` |
| **AS-IS** | Three footer paragraphs (“Next step”, “What this shows”, Star on GitHub) |
| **TO-BE** | Remove “Next step” and “What this shows” once rows state the cause. Optional: keep Star as a single quiet link **or** move to command only — prefer **remove from Overview** to cut noise (commands remain) |
| **Acceptance** | Body does not contain `What this shows` or `Next step:` |
| **Test** | Intended: `overviewHtml` › `dashboard has no footer essays` — **untested** |

### S-FIX-QP-01 — Fix Quick Pick full list

| Field | Value |
|-------|--------|
| **File** | `src/triageHost.ts` |
| **AS-IS** | Quick Pick of all Fix steps from diagnose/recommend |
| **TO-BE** | Keep **full** ordered list from `recommend.ts` (not capped to 3 — toast is capped; Quick Pick is not) |
| **Title** | `Fix {serverName} ({causeId})` |
| **Anti-pattern** | Replacing Quick Pick with a custom webview wizard |
| **Acceptance** | Given auth.expired, when Fix opens, then items include terminal/copy login and retry.probe |
| **Test** | Prefer unit on `recommendActions` order; EH manual for pick UI — **partial** |

### S-VERIFY-01 — post-Fix outcome on row

| Field | Value |
|-------|--------|
| **File** | Overview / triage glue (Phase 1 may be in-memory only per ARCH) |
| **AS-IS** | No durable verifiedOutcome on Overview |
| **TO-BE** | After Fix that claims recovery + re-probe: quiet meta `Verified: resolved` \| `unresolved` \| `worsened` \| `unknown` (catalog C-VERIFY-*) |
| **Acceptance** | Given verifyRecovery resolved, when Overview refreshes, then meta shows Verified: resolved |
| **Test** | Intended after wiring — **untested** |

---

## Live / unit verification checklist

| When | Check |
|------|--------|
| Every change | `npm run test:unit` (and `npm run compile` / `npm run build` when shipping code) |
| Overview copy | Assertions in [`test/unit/overviewHtml.test.ts`](../../test/unit/overviewHtml.test.ts) |
| Diagnose rows | [`test/unit/diagnose.test.ts`](../../test/unit/diagnose.test.ts) + new derive/verify cases |
| Before UI merge | Extension Host: empty, untrusted, healthy, failed, host-unknown — sentence visible, primary control reachable, no horizontal scroll |
| Release | One Marketplace clip only ([GIF-RECORDING.md](../media/GIF-RECORDING.md)) |
| Out | Full-window pixel-diff CI |

## Accessibility baseline

- Contrast: theme tokens only (do not claim WCAG numbers without measuring).  
- Icon-only controls need accessible names (button text or `aria-label`).  
- Existing `data-action` buttons remain keyboard-activatable.  
- Do not convey state by color alone — always state word + icon.
