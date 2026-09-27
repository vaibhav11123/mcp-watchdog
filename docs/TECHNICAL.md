# MCP Watchdog — Technical Design Document

**Product:** MCP Watchdog (VS Code / Cursor extension)  
**Version documented:** 0.2.1  
**Publisher:** `mcp-watchdog`  
**License:** MIT  
**Repository:** https://github.com/vaibhav11123/mcp-watchdog  
**Audience:** Engineers, reviewers, and curious non-engineers who want the full “what / why / how” of this codebase.

This document is the single dense reference for architecture, product decisions, security model, state machines, settings, testing, and evolution. User-facing how-to lives in the [README](../README.md); release history lives in the [CHANGELOG](../CHANGELOG.md).

---

## Table of contents

1. [Plain-English overview](#1-plain-english-overview)
2. [The problem we solve](#2-the-problem-we-solve)
3. [What this product is (and is not)](#3-what-this-product-is-and-is-not)
4. [Glossary](#4-glossary)
5. [High-level architecture](#5-high-level-architecture)
6. [Design decisions (with rationale)](#6-design-decisions-with-rationale)
7. [Module map](#7-module-map)
8. [Configuration system](#8-configuration-system)
9. [Trust and security model](#9-trust-and-security-model)
10. [Monitoring engine (`ServerMonitor`)](#10-monitoring-engine-servermonitor)
11. [Alerting and flap detection](#11-alerting-and-flap-detection)
12. [User interface surfaces](#12-user-interface-surfaces)
13. [Settings reference](#13-settings-reference)
14. [Commands and activation](#14-commands-and-activation)
15. [Dependencies and build pipeline](#15-dependencies-and-build-pipeline)
16. [Testing strategy](#16-testing-strategy)
17. [CI, packaging, and release](#17-ci-packaging-and-release)
18. [Evolution history](#18-evolution-history)
19. [Known limitations and deferred work](#19-known-limitations-and-deferred-work)
20. [Contributor invariants](#20-contributor-invariants)
21. [Appendix: numbers cheat sheet](#21-appendix-numbers-cheat-sheet)

---

## 1. Plain-English overview

Imagine your editor (Cursor, VS Code, Windsurf, …) talks to helper programs called **MCP servers**. Those helpers give the AI tools: memory, filesystem access, APIs, and so on.

Sometimes those helpers **die quietly**. The laptop sleeps. An `npx` process crashes. The network blips. The editor’s UI may still look fine until you try a tool mid-task and it fails.

**MCP Watchdog** is a **smoke detector for those helpers**. It sits next to your editor’s own MCP client and periodically asks: “Can *I* still reach this server?” If not, it:

- updates a status-bar count (`MCP: healthy/total`),
- shows per-server detail in an activity-bar panel,
- toasts with **Reconnect**, **Show Log**, **Reload Window**, or **Mute 1h**.

It does **not** replace the editor’s MCP integration. It cannot reach into Cursor’s private connection and “fix” it. When the editor itself is stuck, the honest remediation is **Reload Window** — and Watchdog puts that action on the failure toast.

Think of three layers:

| Layer | Who owns it | What it does |
|-------|-------------|--------------|
| Editor MCP client | Cursor / VS Code | Real agent tool calls |
| MCP servers | You (via `mcp.json`) | The actual helper processes / HTTP endpoints |
| **MCP Watchdog** | This extension | Parallel health probes + alerts + reconnect UX |

---

## 2. The problem we solve

### 2.1 User pain (demand side)

Documented pain that shaped the product:

1. Cursor MCP often fails to reconnect after network drops or sleep/wake; users must reload the window.
2. Repeated “Not connected” / disconnect loops with no clear status surface.
3. Feature requests for **auto-reconnect** and for **MCP status in the status bar**.
4. Side effects like “Kill Tasks” disconnecting all MCPs with no refresh button.

As users attach more MCP servers, failure surface grows. A silent disconnect mid-agent-task is expensive.

### 2.2 Market position (why an extension)

| Approach | Strength | Gap Watchdog fills |
|----------|----------|--------------------|
| VS Code native MCP | Built-in list, restart on config save, trust model | No periodic ping/latency, weaker sleep/wake story |
| Cursor built-in MCP UI | Owns real agent connections | Weak reconnect; no status bar; no extension API to observe/reset |
| Standalone health daemons | History, sparklines, deep metrics | Extra process; not in-editor; no one-click Reload Window |
| Inspectors / debuggers | Deep protocol inspection | Not continuous monitoring |

**Wedge:** the only **in-editor, zero-daemon, continuous health layer** that works well in **Cursor** (and other Open VSX forks). In Microsoft VS Code, native MCP erodes some value — Cursor/forks are the beachhead.

### 2.3 Hard truths we designed around

These are deliberate constraints, not accidents:

| Hard truth | Product response |
|------------|------------------|
| **A. Duplicate stdio instances** — a long-lived second copy of every server doubles RAM/CPU and can break stateful servers | Default **`interval`** probe: connect → ping → close (no long-lived duplicate between checks) |
| **B. Watchdog health ≠ editor health** | Honest README + tooltip semantics; failure toasts include **Reload Window** |
| **C. Silent failure** | Toasts (default: failures only), severity-colored status bar, flap consolidation |
| **D. Auto-connect without consent** | Default **`requireApproval: true`** trust gate before any spawn/HTTP |
| **E. Config fragmentation** | Merge Cursor + VS Code project/global `mcp.json` shapes (`servers` / `mcpServers`) |

---

## 3. What this product is (and is not)

### 3.1 Is

- A **parallel observer** that opens its own MCP SDK client (`name: 'mcp-watchdog'`) per approved server.
- A **reachability + latency** meter using MCP `ping`.
- An **alerting and remediation UX** (reconnect Watchdog’s probe; reload window for the editor).
- A **trust-gated** runner of user-defined commands/URLs from config files the user already maintains.

### 3.2 Is not

- Not a replacement for the editor’s MCP client.
- Not an MCP gateway/proxy.
- Not team/fleet SaaS monitoring.
- Not an OAuth client for remote MCP auth flows.
- Not a guarantee that “Healthy” means the agent’s session is healthy — only that **Watchdog’s probe** succeeded.

### 3.3 Honest scope sentence (canonical)

> Watchdog opens its **own** read-only health connections to measure reachability and latency — it cannot fix editor-internal MCP state without you reloading.

---

## 4. Glossary

| Term | Meaning |
|------|---------|
| **MCP** | Model Context Protocol — standard for AI tools talking to external servers |
| **stdio transport** | Editor/Watchdog spawns a local process (`command` + `args`) and talks over stdin/stdout |
| **HTTP / Streamable HTTP** | Remote (or local HTTP) MCP endpoint via URL (+ optional headers) |
| **SSE** | Older Server-Sent Events transport; Watchdog does **not** use a dedicated SSE client — URL entries normalize to HTTP/streamable |
| **Probe** | One health check cycle (connect + `ping`, possibly close) |
| **Interval mode** | Connect → ping → close each cycle (default) |
| **Persistent mode** | Keep one client open; ping on a timer (legacy 0.1.x behavior) |
| **Trust / approval** | User must allow monitoring before spawn/HTTP when `requireApproval` is true |
| **Fingerprint** | SHA-256 of server names + command/args/url (not env/header **values**) |
| **Flapping** | Too many failures in a short window → one consolidated alert |
| **Degraded** | Temporary bad state while retries are still allowed (UI label: “Reconnecting”) |
| **VSIX** | Packaged VS Code extension file |
| **Open VSX** | Extension registry Cursor and many forks use (vs Microsoft Marketplace) |
| **Memento** | VS Code persistent key-value store (`globalState`) used for trust + first-run flags |

---

## 5. High-level architecture

### 5.1 Logical diagram

```text
┌─────────────────────────────────────────────────────────────────┐
│ package.json contributes (commands, views, settings, walkthrough)│
└───────────────────────────────┬─────────────────────────────────┘
                                │ activate (onStartupFinished)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ extension.ts — orchestration                                    │
│  • loadMcpConfig / TrustStore / options                         │
│  • Map<name, ServerMonitor>                                     │
│  • AlertManager → VS Code toasts                                │
│  • refreshAllUi → StatusBar | ServersTree | Overview webview    │
└───────────────┬─────────────────────────────┬───────────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────┐   ┌─────────────────────────────────┐
│ config.ts (vscode I/O)    │   │ UI (vscode)                     │
│  → config-core.ts (pure)  │   │ statusBar, serversTree,         │
└───────────────────────────┘   │ overviewView, logger,           │
                                │ ui/statePresentation            │
┌───────────────────────────┐   └─────────────────────────────────┘
│ ServerMonitor (monitor.ts)│
│  interval | persistent    │──── Client.ping ──► @modelcontextprotocol/sdk
│  backoff + jitter         │     StdioClientTransport
└───────────────────────────┘     StreamableHTTPClientTransport
         ▲
         │ pure helpers
┌────────┴────────┬──────────────┬─────────────┐
│ options.ts      │ trust.ts     │ alerts.ts   │
│ jitter/debounce │ fingerprint  │ decideAlert │
└─────────────────┴──────────────┴─────────────┘
```

### 5.2 Layering rule (task W1)

Critical business logic must be **unit-testable without a VS Code host**:

| Must stay vscode-free | May import `vscode` |
|-----------------------|---------------------|
| `monitor.ts`, `config-core.ts`, `options.ts`, `trust.ts`, `alerts.ts` | `extension.ts`, `config.ts`, `statusBar.ts`, `serversTree.ts`, `overviewView.ts`, `logger.ts`, `ui/statePresentation.ts` |

`config.ts` is a thin FS/workspace glue over `config-core.ts`.

### 5.3 Data flow (status → UI)

```text
ServerMonitor.setStatus
  → extension.onServerStatus
       → AlertManager.onStatusChange (may toast; may set flapping)
       → statuses Map
       → refreshAllUi()
            → McpStatusBar.update
            → ServersTreeProvider.refresh
            → OverviewViewProvider.update
```

---

## 6. Design decisions (with rationale)

Each row is a deliberate choice. “Alternative rejected” captures what we explicitly did **not** do.

| # | Decision | Rationale | Alternative rejected |
|---|----------|-----------|----------------------|
| D1 | Parallel health client, not editor proxy | No reliable extension API to observe/reset Cursor/VS Code MCP sessions | Pretend we can “sync” editor state |
| D2 | Default probe mode = **`interval`** | Avoid long-lived duplicate stdio children (RAM, npx cold starts, stateful side effects) — #1 architectural objection | Keep 0.1.x persistent-as-default |
| D3 | Keep **`persistent`** as opt-in | Some servers lose session state on disconnect | Remove persistent entirely |
| D4 | Default **`requireApproval: true`** | Opening a folder must not execute every command in any `mcp.json` without consent | Auto-connect always (0.1.x) |
| D5 | Fingerprint **excludes env/header values** | Secret rotation must not re-prompt; secrets must never appear in UI/logs | Hash full JSON including secrets |
| D6 | Notify default = **`failures`** | Watchdogs that spam get muted | Toast on every recovery by default |
| D7 | Degraded toast delayed **60s** | One missed ping ≠ incident | Immediate toast on first degrade |
| D8 | Flap: **>3 failures in 10 minutes** | Collapse noise into one alert | Unlimited failure toasts |
| D9 | Failure actions include **Reload Window** | Documented fix for stuck editor MCP | Only reconnect Watchdog’s probe |
| D10 | Exactly **five** server states | Shared presentation contract across all UI | Ad-hoc strings / extra states |
| D11 | Single runtime dep: **MCP SDK** | Small VSIX, limited attack surface, track protocol via official client | Add HTTP libs, SQLite, UI frameworks |
| D12 | esbuild bundle + `tsc --noEmit` | Fast ship artifact + strict typecheck | Ship unbundled TS / skip typecheck |
| D13 | Activity bar UI (not Extensions page) | Extensions detail page is only Marketplace README — users thought the product was “blank” | Rely on Extensions sidebar alone |
| D14 | Merge three Cursor/VS Code config paths | Meet Cursor users where config actually lives (0.1.3 fix) | Only `.vscode/mcp.json` |
| D15 | Accept both `servers` and `mcpServers` | VS Code vs Cursor JSON shapes | Force one schema |
| D16 | Multi-root = **first folder only** | Simple, predictable `${workspaceFolder}` | Half-implemented multi-root |
| D17 | ±10% **jitter** on timers | Avoid thundering herd when many servers share interval | Exact simultaneous pings |
| D18 | Window **focus → wakeUp (500ms)** | Faster recovery after sleep / context switch | Wait for next 30s tick only |
| D19 | Live settings reload (500ms debounce) | No window reload for tuning intervals/modes | Require reload for settings |
| D20 | No telemetry | Privacy marketing + trust for a tool that runs user commands | Opt-in crash analytics (deferred) |
| D21 | Dual publish: Open VSX + Marketplace | Cursor/forks need Open VSX; VS Code uses Marketplace | Marketplace only |
| D22 | Unit tests offline; network in `scripts/` | Fast, deterministic CI | Hit npx in every unit test |
| D23 | Coverage floors on `monitor` + `config-core` | Protect the state machine and parser | Coverage theater on UI glue only |
| D24 | Codicons / ThemeIcons, **no emoji** in UI | Matches VS Code design language | Emoji status icons |
| D25 | Overview uses strict webview CSP | Marketplace security expectations | Loose CSP / remote scripts |

---

## 7. Module map

Approximate source size at 0.2.1 (~2140 LOC under `src/`):

| File | LOC (approx) | vscode? | Responsibility |
|------|-------------:|---------|----------------|
| `extension.ts` | 568 | Yes | Activation, commands, trust gate, monitor lifecycle, alert wiring, host test API |
| `overviewView.ts` | 389 | Yes | Webview dashboard (metrics, list, actions) |
| `monitor.ts` | 302 | **No** | Per-server state machine + MCP client probes |
| `alerts.ts` | 254 | **No** | Pure `decideAlert` + `AlertManager` |
| `config-core.ts` | 143 | **No** | Parse / normalize / merge MCP JSON shapes |
| `config.ts` | 128 | Yes | FS + workspace glue, file watchers |
| `serversTree.ts` | 84 | Yes | Activity-bar tree |
| `statusBar.ts` | 73 | Yes | Aggregate status bar item |
| `trust.ts` | 70 | **No** | Fingerprint + `TrustStore` (memento-agnostic) |
| `options.ts` | 60 | **No** | Probe options, jitter, debounce, per-server resolve |
| `ui/statePresentation.ts` | 36 | Yes | Labels / ThemeIcons for five states + untrusted |
| `logger.ts` | 33 | Yes | `LogOutputChannel` “MCP Watchdog” |

Supporting trees:

| Path | Role |
|------|------|
| `test/unit/` | Vitest, no network, no VS Code host |
| `test/host/` | `@vscode/test-electron` host tests |
| `scripts/` | Smoke / integration / verify / release helpers |
| `mcp-watchdog-test/` | Fixture workspace (excluded from VSIX) |
| `images/` | Icon + Marketplace screenshots |
| `.cursor/rules/mcp-watchdog.mdc` | Contributor invariants |
| `.github/workflows/` | `ci.yml`, `release.yml` |

There are **no formal ADRs** in-repo. Decisions live in this document, README, CHANGELOG, and the project rule file.

---

## 8. Configuration system

### 8.1 Files Watchdog reads (merge order)

Later layers **override** earlier layers for the same server name:

| Priority | Path | Typical audience |
|---------:|------|------------------|
| 1 (lowest) | `~/.cursor/mcp.json` | Cursor global |
| 2 | `<workspace>/.vscode/mcp.json` | VS Code project |
| 3 (highest) | `<workspace>/.cursor/mcp.json` | Cursor project |

Workspace root = **first** `workspaceFolders[0]` entry only.

### 8.2 Accepted JSON shapes

Top-level block may be either:

- `servers` (VS Code style), or
- `mcpServers` (Cursor style)

Each entry normalizes to:

```ts
// stdio
{ type: 'stdio', command: string, args?: string[], env?: Record<string,string>, cwd?: string }

// http
{ type: 'http', url: string, headers?: Record<string,string> }
```

Normalization rules (`normalizeServerEntry`):

- Treated as HTTP if `type === 'http'` **or** a non-empty `url` is present.
- Else treated as stdio if a non-empty `command` is present.
- Entries missing both command and url are **dropped** (not fatal).
- Explicit `type: "http"` without `url` is dropped.

**SSE note:** even if an editor config used `type: "sse"`, Watchdog normalizes URL-bearing entries to **`http`** and uses `StreamableHTTPClientTransport`. There is no `SSEClientTransport` path.

### 8.3 Variable expansion

Only **`${workspaceFolder}`** is expanded (recursively through strings/arrays/objects).

Why: VS Code substitutes this for its own MCP loader; Watchdog reads JSON from disk, so it must expand explicitly. **`${env:…}`** and **`${input:…}`** are **not** supported yet (known limitation).

### 8.4 Load statuses (`McpConfigStatus`)

| Kind | Meaning | Empty-view message (summary) |
|------|---------|------------------------------|
| `no_workspace` | No folder open | Open a folder… |
| `no_config` | No readable layer | Add `.vscode` / `.cursor` / `~/.cursor` mcp.json |
| `empty_servers` | Files found, zero valid servers | Need `servers`/`mcpServers` with command or url |
| `untrusted` | Config OK, approval pending | Run Review Trusted Servers / click status bar |
| `ok` | Ready to monitor (subject to allowlist) | (empty) |

Invalid JSON in a layer → error notification naming the file; that layer is skipped. Missing file (`ENOENT`) → skip silently.

### 8.5 File watching

`watchMcpConfig` registers VS Code `FileSystemWatcher`s for all three paths (change/create/delete). On change: clear trust-prompt latch → `reloadServers()`. Workspace folder changes rebuild `TrustStore` and watchers.

### 8.6 Open / scaffold config

Command **Open MCP Config** prefers existing `.cursor/mcp.json`, then `.vscode/mcp.json`, or scaffolds a template (`mcpServers` vs `servers` depending on target).

---

## 9. Trust and security model

### 9.1 Why a trust gate exists

Before 0.2.0, activation could **immediately spawn every stdio command** and open every HTTP URL found in merged config — including global `~/.cursor/mcp.json` written by anything else. That is arbitrary command execution on folder-open. VS Code’s native MCP has an explicit trust model for the same reason. Watchdog’s gate closes that Marketplace/security objection.

### 9.2 Behavior when `mcpWatchdog.requireApproval` is `true` (default)

1. Load and merge config.
2. Compute fingerprint of the server set.
3. If stored approval fingerprint does not match:
   - Do **not** start monitors.
   - Show untrusted UI (`$(shield) MCP: untrusted`).
   - Toast once: **Review & Allow** / **Not now**.
4. **Review & Allow** → multi-select QuickPick (`name — command args` or `name — url`).
5. Persist `{ fingerprint, allowedServers }` in `globalState` under  
   `mcpWatchdog.trust.<workspaceFolderFsPath>`.
6. Start monitors **only** for the allowed subset. Others stay `disconnected` with “Not in trusted subset”.
7. Changing command, args, or URL changes the fingerprint → re-prompt.
8. Changing **only** env values or header values does **not** change the fingerprint (by design).

When `requireApproval` is `false`: auto-connect like 0.1.x (documented for trusted single-user machines).

### 9.3 Secret handling invariant

**Never log or render env var values or HTTP header values.** Names are fine; values never.

Enforced by:

- Project rule (`.cursor/rules/mcp-watchdog.mdc`)
- Fingerprint + `formatServerSummary` omitting secrets
- Unit tests asserting env/header-only changes do not alter fingerprint
- UI/logs showing command+args, URLs, errors, latency — not secrets

Values **are** still passed to the SDK for real connections (stdio `env`, HTTP `headers`) so servers work.

### 9.4 Other security properties

- Overview webview CSP: restrictive (`default-src 'none'`, nonce for scripts).
- No bundled analytics/telemetry.
- SECURITY.md: private advisory reporting; scope includes user-defined commands/endpoints.
- Extension runs **user-configured** code/endpoints — trust your `mcp.json`.

### 9.5 Trust API surface

| Symbol | Role |
|--------|------|
| `computeServerSetFingerprint` | Order-independent SHA-256 |
| `formatServerSummary` | Safe one-line description for QuickPick |
| `TrustStore.approve / revoke / isServerAllowed` | Persistence + subset checks |
| Command `mcpWatchdog.reviewTrust` | Re-open allowlist / revoke |

---

## 10. Monitoring engine (`ServerMonitor`)

### 10.1 Exact states

```text
connecting | healthy | degraded | failed | disconnected
```

Do not add states without updating **together**: `monitor.ts`, `ui/statePresentation.ts`, `statusBar.ts`, `serversTree.ts`, `overviewView.ts`.

| State | UI label | Meaning |
|-------|----------|---------|
| `healthy` | Healthy | Last probe/ping succeeded |
| `connecting` | Connecting | Attempt in flight |
| `degraded` | Reconnecting | Failure occurred; retries still allowed |
| `failed` | Failed | Gave up (max retries) or hard connect failure (persistent) |
| `disconnected` | Offline | Stopped, disabled, or awaiting trust |

`flapping` is a **status flag** set by `AlertManager`, not a sixth state.

### 10.2 Probe modes

#### Interval (default)

```text
start / wakeUp / retry
  → connecting
  → connect + ping + close
       OK  → healthy → schedule next probe (pingIntervalMs ± jitter)
       ERR → degraded → scheduleRetry (backoff ± jitter)
            → after maxRetries → failed (stop scheduling)
stop → disconnected
```

Between successful checks there is **no** long-lived stdio child.

#### Persistent (legacy)

```text
start → connecting
  → connect OK → healthy → schedulePing
  → connect ERR → failed → scheduleRetry → connecting…
ping OK → healthy
ping ERR → degraded → close client → scheduleRetry
max retries → failed
stop → disconnected
```

Use for stateful servers that lose session state if the client disconnects — deliberately, not by default.

### 10.3 Backoff

```text
delay = min(initialBackoffMs * backoffMultiplier^retryCount, maxBackoffMs)
actualWait = jittered(delay)   // ±10%
retryCount++
```

Defaults: `1000 * 1.5^n`, cap `30000`, max **5** retries → `lastError: 'Max retries exceeded'`.

Logged delay is pre-jitter; scheduled wait is jittered.

### 10.4 Health check primitive

Both modes use MCP SDK:

```text
client.ping({ timeout: pingTimeoutMs })  // default 5000 ms
```

Client identity: `{ name: 'mcp-watchdog', version: '1.0.0' }`, empty capabilities.

### 10.5 Transports

| Config | SDK class | Notes |
|--------|-----------|-------|
| stdio | `StdioClientTransport` | `command`, `args`, `env`, `cwd` |
| http | `StreamableHTTPClientTransport` | URL + optional headers via `requestInit` |

HTTP also receives SDK `reconnectionOptions` mapped from Watchdog backoff settings. README notes possible **double-retry** interaction (SDK + Watchdog).

### 10.6 Public monitor API

| Method | Behavior |
|--------|----------|
| `start()` | Interval cycle or persistent connect |
| `stop()` | Clear timers, close client, `disconnected` |
| `forceReconnect()` | Reset retries, stop, restart |
| `wakeUp()` | After 500ms: re-probe / ping / reconnect |
| `getStatus()` / `getRecentLog()` | Snapshot + last ≤20 log lines |

### 10.7 Testability seams

- Injectable `MonitorClock` (`setTimeout` / `clearTimeout` / `now`)
- Injectable `MonitorClientFactory`
- Injectable `jitterRand` (tests use `() => 0.5` for factor `1.0`)

### 10.8 Triggers outside the monitor

| Trigger | Effect |
|---------|--------|
| Trust pending | Placeholders: disconnected + “Awaiting approval” |
| Not in trusted subset | disconnected + “Not in trusted subset” |
| `perServer.enabled: false` | disconnected + `disabled: true` (no monitor) |
| Config / settings reload | stop all → clear → rebuild |
| Window focus | `wakeUp()` on each monitor |

---

## 11. Alerting and flap detection

### 11.1 Philosophy

Bark loudly enough to be useful; quiet enough not to be muted forever.

- Default `notify: failures` — recovery toasts only if `notify: all`.
- Sustained degraded waits `degradedAlertDelayMs` (60s) before warning.
- Flapping consolidates spam.

### 11.2 Pure function `decideAlert`

Inputs: previous/next status, mute, notify mode, now, flap state, degraded-since, delay.

Notable rules:

1. `notify === 'none'` or `disabled` → no alert.
2. Active mute → no alert.
3. Recovery to `healthy` from `degraded|failed` → clear flap; info toast only if `notify === 'all'`.
4. Failure transition from `healthy|connecting` → `degraded|failed` increments flap window.
5. When failure count **> 3** within 10 minutes (i.e. 4th failure): set flapping; emit **one** flap alert (`Show Log`, `Mute 1h`).
6. Immediate `healthy → degraded` does **not** toast; starts degraded timer.
7. After delay, still degraded and not flapping → warning with full actions.
8. Hard `→ failed` (not flapping) → error toast with full actions.

### 11.3 Toast actions (wired in `extension.ts`)

| Action | Effect |
|--------|--------|
| Reconnect | `forceReconnect()` on that monitor |
| Show Log | Focus Output + dump recent monitor log |
| Reload Window | `workbench.action.reloadWindow` |
| Mute 1h | `AlertManager.mute(server, 3_600_000)` |

### 11.4 Constants

| Name | Value |
|------|------:|
| `FLAP_WINDOW_MS` | 10 minutes |
| `FLAP_THRESHOLD` | 3 (alert when length **>** 3) |
| `DEFAULT_DEGRADED_ALERT_DELAY_MS` | 60_000 |

---

## 12. User interface surfaces

### 12.1 Where the real UI lives

VS Code has two different sidebars. This confused early users enough to ship a walkthrough:

| Place | What you see |
|--------|----------------|
| **Extensions** → click MCP Watchdog | Marketplace README only — **not** the live dashboard |
| **Activity bar** → MCP Watchdog icon | **Overview** (webview) + **Servers** (tree) — the real product |

Also: status bar (bottom right), Output channel “MCP Watchdog”, Getting Started walkthrough, `viewsWelcome` empty states.

First install: globalState key `mcpWatchdog.didRevealServersView` → focus Overview/Servers once after ~750ms.

### 12.2 Status bar (`McpStatusBar`)

- Aggregate `MCP: healthy/total` with severity backgrounds.
- Untrusted: `$(shield) MCP: untrusted`.
- Empty: `$(circle-slash) MCP`.
- Click → `mcpWatchdog.showStatus` (or re-offer trust).

### 12.3 Servers tree

Flat list of servers with label + description (`Healthy · 12 ms`, probe mode, flapping/disabled hints). Context/inline reconnect. Empty message from `emptyViewMessage(lastConfigStatus)`.

### 12.4 Overview webview

Theme-colored dashboard: metric tiles, server rows, actions via `postMessage` (`reconnectAll`, `openConfig`, `showOutput`, `openFolder`, `reviewTrust`, `reconnect`). HTML escaped; secrets never rendered. Strict CSP.

### 12.5 Shared presentation

`STATE_PRESENTATION` maps states → human labels + codicons. `UNTRUSTED_PRESENTATION` uses shield icon. Policy: **no emoji in UI**.

---

## 13. Settings reference

All keys under `mcpWatchdog.*`, read via `vscode.workspace.getConfiguration('mcpWatchdog')`. Changes debounce **500ms** then `reloadServers()` (no window reload).

| Setting | Default | Controls |
|---------|---------|----------|
| `pingIntervalMs` | `30000` | Cadence between successful probes/pings |
| `pingTimeoutMs` | `5000` | Per-ping timeout |
| `maxRetries` | `5` | Attempts before `failed` |
| `initialBackoffMs` | `1000` | First retry delay |
| `backoffMultiplier` | `1.5` | Exponential growth |
| `maxBackoffMs` | `30000` | Cap |
| `requireApproval` | `true` | Trust gate |
| `probeMode` | `"interval"` | `interval` \| `persistent` |
| `degradedAlertDelayMs` | `60000` | Wait before degraded warning toast |
| `notify` | `"failures"` | `all` \| `failures` \| `none` |
| `perServer` | `{}` | Per name: `probeMode`, `pingIntervalMs`, `enabled` |

Per-server overrides only cover those three fields; other knobs stay global.

Also applied in code (not settings): **±10% jitter** on scheduled delays.

---

## 14. Commands and activation

### 14.1 Activation

- `activationEvents`: `["onStartupFinished"]`
- `main`: `./dist/extension.js` (esbuild bundle of `src/extension.ts`)
- `engines.vscode`: `^1.105.0`

### 14.2 Activate sequence (ordered)

1. Create `TrustStore`, `Logger`, `AlertManager`, status bar.
2. Register Overview + Servers views.
3. Register commands.
4. Hook window focus → `wakeUp()`; workspace folders → reload; config watchers; settings debounce.
5. `await reloadServers()`.
6. First-run reveal after 750ms.
7. Return host-test API:

```ts
interface McpWatchdogApi {
  getStatuses(): ServerStatus[];
  getLastAlert(): AlertDecision | undefined;
  revokeTrustForTests(): Promise<void>;
}
```

`deactivate()` stops all monitors.

### 14.3 Commands

| Command ID | Title |
|------------|-------|
| `mcpWatchdog.showStatus` | Show Server Status |
| `mcpWatchdog.reconnectAll` | Reconnect All Servers |
| `mcpWatchdog.reconnectServer` | Reconnect Server… |
| `mcpWatchdog.reconnectOne` | Reconnect Server (tree) |
| `mcpWatchdog.focusServersView` | Open Servers View |
| `mcpWatchdog.openMcpConfig` | Open MCP Config |
| `mcpWatchdog.showOutput` | Show Output Log |
| `mcpWatchdog.refresh` | Refresh |
| `mcpWatchdog.reviewTrust` | Review Trusted Servers |

Menus: view title toolbar (refresh / reconnect all / open config); tree item inline reconnect.

---

## 15. Dependencies and build pipeline

### 15.1 Runtime dependency (only one)

```json
"@modelcontextprotocol/sdk": ">=1.29.0 <2.0.0"
```

Everything else: Node builtins (`fs`, `path`, `os`, `crypto`) + VS Code API (`external:vscode` in the bundle).

**Do not add runtime deps without asking** (project rule).

### 15.2 Build commands

| Script | What it does |
|--------|----------------|
| `npm run build` | esbuild → `dist/extension.js` (cjs, node, external vscode) |
| `npm run compile` | `tsc --noEmit` (strict) |
| `npm run vscode:prepublish` | `build` |

**Both `compile` and `build` must pass before claiming done.**

### 15.3 Dev tooling

TypeScript, ESLint, Prettier, Vitest + coverage, `@vscode/test-electron` / test-cli, Mocha (host), esbuild.

---

## 16. Testing strategy

### 16.1 Tiers

| Tier | Command | Location | Constraints |
|------|---------|----------|-------------|
| Unit | `npm run test:unit` | `test/unit/*.test.ts` | Vitest, node, **no network / no VS Code** |
| Smoke | `npm run smoke` | `scripts/smoke-connect.mjs` | Live npx memory server + ping |
| Integration | `node scripts/test-integration.mjs` | scripts + fixture workspace | Config merge + interval probe |
| Host | `npm run test:host` | `test/host/` | Real VS Code (xvfb in CI) |
| Full | `npm test` | — | compile + build + unit + smoke + integration |

Extra verifiers: `verify-interval-probe.mjs`, `verify-trust-spawn.mjs`.

### 16.2 Unit files (behavioral contracts)

- `monitor.test.ts` — state machine, backoff, wakeUp, forceReconnect, stop
- `monitor-default-factory.test.ts` — transport construction
- `config-core.test.ts` — parse/merge/normalize/expand
- `options.test.ts` — jitter, debounce, per-server resolve
- `trust.test.ts` — fingerprint stability + memento round-trip
- `alerts.test.ts` — decideAlert / flap / mute / degraded delay

Coverage targets (`vitest.config.ts`): high thresholds on `monitor.ts` and `config-core.ts` (≈85% lines/functions/statements, ≈80% branches).

### 16.3 Fixture workspace

`mcp-watchdog-test/` — echo / memory / filesystem / flaky servers for F5 launch and integration. Excluded from published VSIX.

---

## 17. CI, packaging, and release

### 17.1 CI (`ci.yml`)

Typical matrix:

- Lint / format / compile
- Unit tests on ubuntu / macOS / windows
- Smoke + integration
- Host tests against pinned VS Code (`1.105.0`) and `stable` (xvfb on Linux)

**Host-fixture isolation (CI stability):** the `mcp-watchdog-test` fixture workspace disables noisy `npx`-backed servers (`memory` / `filesystem` with `enabled: false` in settings) so the host job is not tripped by memory/filesystem noise. Lint, unit, and integration tiers still pass without network.

### 17.2 Packaging

- Lean VSIX: exclude `launch/`, fixtures, tests, `*.local.md`, `node_modules` leakage, etc. (`.vscodeignore`).
- Never commit `*.vsix` or `*.local.md`.

### 17.3 Release

- Maintainer bumps version (agents must not).
- Pipeline is **designed for dual publish**: **VS Marketplace** (`VSCE_PAT`) + **Open VSX** (`OVSX_PAT`). Marketplace is live at **0.2.1**; Open VSX is pending until the first successful `ovsx publish`.
- `release.yml` on `v*` tags; helper `./scripts/ship-release.sh`.
- When `VSCE_PAT` / `OVSX_PAT` secrets are empty, `release.yml` **soft-skips** the corresponding Marketplace / Open VSX publish steps (GitHub release + `.vsix` artifact still proceed).
- Secrets setup documented in CONTRIBUTING.md.

### 17.4 Distribution channels

| Channel | Audience | Status (0.2.1) |
|---------|----------|----------------|
| Open VSX | Cursor, Windsurf, VSCodium, most forks | Pending — designed for dual publish; first `ovsx publish` not done yet |
| VS Marketplace | Microsoft VS Code | Live — `mcp-watchdog.mcp-watchdog@0.2.1` public |
| GitHub Releases | Airgapped / manual `.vsix` | Live — releases + `.vsix` exist |

### 17.5 Live distribution status (as of 2026-09-27)

README badges vs reality:

| Item | Badge image | Reality |
|------|-------------|---------|
| CI | Renders | Was failing on host (1.105.0) from npx memory/filesystem noise; lint/unit/integration pass. Host-fixture isolation disables those servers (`enabled: false`). |
| GitHub release | Renders (static v0.2.1) | OK — releases + .vsix exist |
| License MIT | Renders | OK — LICENSE present |
| Open VSX | Renders (static Install) | Dead until published — API 404; namespace mcp-watchdog missing; OVSX_PAT was never set on release runs |
| VS Marketplace | Renders | OK — mcp-watchdog.mcp-watchdog@0.2.1 public |

Additional notes:

- **CI:** historical failures were isolated to the **host** job (`npx` memory/filesystem noise). See §17.1 host-fixture isolation.
- **Release soft-skip:** empty `VSCE_PAT` / `OVSX_PAT` → Marketplace / Open VSX publish steps are skipped without failing the workflow.
- **Open VSX first publish needs:**
  1. `npx ovsx create-namespace mcp-watchdog` (once; requires a personal access token with namespace rights)
  2. Then `ovsx publish` (or the `release.yml` Open VSX step with `OVSX_PAT` set)

---

## 18. Evolution history

| Version | Date | Theme |
|---------|------|--------|
| **0.1.0** | 2026-05-15 | Initial: ping loop, backoff, status bar, Servers tree, log, `.vscode/mcp.json`, stdio+HTTP, window-focus wake |
| **0.1.1–0.1.2** | 2026-05-16 | Icon, publisher id, screenshots, packaging hygiene, repo URL |
| **0.1.3** | 2026-05-16 | **Cursor config paths** (`.cursor` + `~/.cursor`), empty-state UX, Open MCP Config |
| **0.1.4** | 2026-05-16 | Walkthrough + first-run focus (activity bar vs Extensions confusion) |
| **0.1.5** | 2026-05-16 | Overview webview, toolbar actions, human labels/ThemeIcons |
| **0.1.6** | 2026-05-29 | Marketplace badge fix |
| **0.2.0** | 2026-05-29 | **Trust gate**, **interval default**, alerts/flap/mute, per-server overrides, live settings, jitter, vitest + host tests + CI matrix |
| **0.2.1** | 2026-06-10 | Leaner VSIX excludes; release polish |

### 0.2.0 work-order lineage (internal)

The 0.2.0 path was executed as sequenced tasks:

```text
W1 test infra + config-core extract
  → W2 trust gate
  → W3 probe modes (interval default)
  → W4 live settings
  → W5 notifications
  → W6 flap detection
  → W7 host tests
  → W8 CI matrix + lint
  → W9 release + Open VSX
```

That sequencing encodes priority: **testability → safety → light probes → alerts → quality → distribution**.

---

## 19. Known limitations and deferred work

### 19.1 Documented limitations (shipped)

- Does not read other VS Code user-global MCP paths beyond the three listed.
- Independent of editor MCP UI — states can disagree until next probe / reload.
- HTTP may combine SDK reconnection with Watchdog retries.
- Malformed JSON surfaces an error toast; fix and save.
- Multi-root: first folder only.
- No `${env:}` / `${input:}` expansion.
- Missing `images/demo.gif` (README may reference a demo animation that is not in-repo yet).

### 19.2 Explicitly deferred / out of scope (for now)

From product planning (not shipped):

- VS Code user-profile `mcp.json`, Claude Code / Windsurf config paths
- Full multi-root per-folder monitoring
- Dedicated SSE transport + OAuth-aware “auth required” state
- Latency/uptime history, sparklines, incident timeline export
- Tool-drift (`listTools` schema diff)
- Passive-HTTP probe without MCP session
- Acting as MCP gateway/proxy
- Team SaaS / fleet monitoring
- Replacing the editor MCP client (impossible without editor APIs)
- Opt-in telemetry

Strategic bet: ship **trust + light probes + useful alerts + Open VSX** before depth features.

---

## 20. Contributor invariants

From `.cursor/rules/mcp-watchdog.mdc` — treat as hard law:

1. TypeScript strict; `npm run compile` **and** `npm run build` before done.
2. Only runtime dependency: `@modelcontextprotocol/sdk` (ask before adding).
3. `monitor.ts` / `config-core.ts` must not import `vscode`.
4. Never log/render env or header **values**.
5. States are exactly the five listed; update all presentation surfaces together.
6. New settings: `package.json` contributes + `getConfiguration('mcpWatchdog')`.
7. Unit tests: vitest, offline, no VS Code host; network → `scripts/`.
8. User-visible changes: update CHANGELOG (Keep a Changelog) + README.
9. Do not bump version; maintainer releases.
10. No Co-authored-by trailers; never commit `*.local.md` or `*.vsix`.

---

## 21. Appendix: numbers cheat sheet

```text
Ping interval:     30_000 ms (±10% jitter)
Ping timeout:      5_000 ms
Backoff:           min(1000 * 1.5^n, 30_000) then ±10% jitter
Max retries:       5 → failed "Max retries exceeded"
Wake-up delay:     500 ms after window focus
Settings debounce: 500 ms
First-run reveal:  750 ms
Flap window:       10 minutes
Flap threshold:    >3 failures (4th triggers flap alert)
Degraded delay:    60_000 ms before warning toast
Mute duration:     3_600_000 ms (1 hour)
Recent log lines:  20
Probe default:     interval
Notify default:    failures
Trust default:     requireApproval true
Client name:       mcp-watchdog @ 1.0.0
Engine floor:      vscode ^1.105.0
SDK range:         >=1.29.0 <2.0.0
```

### Backoff series (pre-jitter, defaults)

| retryCount used in formula | Delay |
|---------------------------:|------:|
| 0 | 1000 ms |
| 1 | 1500 ms |
| 2 | 2250 ms |
| 3 | 3375 ms |
| 4 | 5063 ms |
| … | capped at 30000 ms |

---

## Closing mental model

If you remember only four sentences:

1. **Watchdog is a parallel smoke detector**, not the editor’s MCP client.
2. **Interval probing is the default** so we don’t leave duplicate servers running.
3. **Nothing connects until you approve** (unless you turn the gate off).
4. **When the editor itself is stuck, Reload Window is the honest fix** — and we put it on the toast.

For day-to-day usage, see the [README](../README.md). For what shipped when, see the [CHANGELOG](../CHANGELOG.md). For vulnerability reporting, see [SECURITY.md](../SECURITY.md).

---

## Appendix B: Measured ops (local bench, 2026-07-22)

Runnable via `node scripts/measure-ops.mjs` (echo fixture; same Client/stdio/ping path as interval `forceReconnect`).

| Metric | Measured value | Method |
|--------|---------------:|--------|
| Median reconnect time | **~119 ms** | 21 sequential connect→ping→close cycles after warmup; median wall clock |
| Reconnect success rate | **100% (21/21)** | Same trials; failures would count against rate |
| Max concurrent monitored servers | **≥128** (capped) | Parallel probes; all 128 healthy within ~17s; no hard product limit |

Notes: local macOS Node bench against `mcp-watchdog-test/fixtures/echo-server.js`. Not production telemetry. `npx`-backed servers will be slower (cold start). Raise cap with `CONCURRENT_MAX=256 node scripts/measure-ops.mjs`.
