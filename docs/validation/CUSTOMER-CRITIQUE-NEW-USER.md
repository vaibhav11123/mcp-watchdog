# New-user customer critique — MCP Watchdog

**Date:** 2026-10-30  
**Method (industry stack):**
1. **Persona + JTBD** (product critique framing — Atlassian)
2. **Cognitive walkthrough** — NN/g 4 questions per step ([nngroup.com](https://www.nngroup.com/articles/cognitive-walkthroughs/))
3. **Heuristic scorecard** — GitLab UX heuristics 1–5 ([handbook.gitlab.com](https://handbook.gitlab.com/handbook/product/ux/heuristics/))
4. **Task success framing** — GitLab usability testing (define success before “pass”)
5. **REA** static inspect of `src/` (`ev_2f0e3bc6…` / view `ev_6da5a79a…`) — activation, trust, overview, monitor surfaces

**Not a substitute for live humans** — this is a structured inspection + think-aloud as one high-fit buyer. Treat findings as a backlog, not gospel.

---

## 1. Customer I am mimicking

| Field | Detail |
|---|---|
| **Name / role** | **Priya** — Staff engineer, 12-person AI product startup |
| **Editor** | **Cursor** daily; occasional VS Code for reviews |
| **JTBD** | When MCP dies mid-agent task, I want to **know immediately and recover in &lt;30s** without guessing Reload vs Reconnect |
| **Setup** | 4 servers: `@modelcontextprotocol/server-memory` (npx -y), filesystem, remote HTTPS tools API, Playwright MCP |
| **Pain last week** | Cursor still listed tools; agent burned 4 minutes on dead MCP; Slack chaos |
| **What she is not** | Not a security buyer; not installing Watchdog Cloud day one; not reading EXECUTION.md |
| **Success criteria** | Install → see health → kill a server → toast with clear recover → back to work. **No README archaeology.** |

**How she finds the app:** Google / coworker paste → Open VSX or Cursor Extensions search “MCP Watchdog”.

---

## 2. Tasks (JTBD-shaped)

| ID | Task | Success = |
|---|---|---|
| T1 | Install in Cursor | Extension active; walkthrough or status visible without hunting |
| T2 | Get first “healthy” signal for real MCP config | Status bar `MCP: n/n` or Overview shows servers |
| T3 | Survive a kill / disconnect | Toast + correct action; Cursor agent tools usable again |
| T4 | Understand trust / what processes will run | Informed consent before `npx` spawn |
| T5 | Decide if Cloud matters | Clear “ignore for now” vs “you need this” |

---

## 3. Cognitive walkthrough (Priya’s voice)

### T1 — Install

| NN/g Q | Verdict | Notes |
|---|---|---|
| Right result? | **Weak** | Marketplace blurb is “status bar and toasts” — she wanted “fix Cursor MCP lying”. Keywords help; description undersells the aha. |
| Notice correct action? | **OK** | Open VSX recommended in README; Cursor users often land on Marketplace by habit → friction. |
| Associate action? | **OK** | Install command is clear. |
| See progress? | **Fail-ish** | After install, **Extensions README ≠ product**. She must know activity bar. Walkthrough exists (`mcpWatchdog.getStarted`) but many Cursor users dismiss Welcome. |

**Priya:** “I installed it. I clicked the extension. It’s just the README again. Is it broken?”

**Severity: P0** — classic VS Code trap; you already document it, but **demo GIF still admits it’s a placeholder** on the live Marketplace README. That kills trust before first probe.

---

### T2 — First healthy signal

| NN/g Q | Verdict | Notes |
|---|---|---|
| Right result? | **OK** | Status bar + Overview are the right goals. |
| Notice action? | **Weak** | Activity bar icon is easy to miss among 12 icons; walkthrough step 1 is good if shown. |
| Associate? | **Fail** | **Trust gate** (`requireApproval: true` default): modal “monitor N servers?” → “Review & Allow” → multi-select QuickPick. Extra hops before any green. Power users get it; panicked users think it’s broken. |
| Progress? | **Mixed** | Once approved, monitors start (REA: `startMonitor` → `ServerMonitor`). Empty/no folder → welcome view. **No MCP config** → she must create `.cursor/mcp.json` — Open MCP Config helps. |

**Priya:** “Why do I approve *again*? Cursor already trusts these servers. And my example README uses `npx -y` while your cloud policy later denies `npx -y`. Mixed signals.”

**Severity: P1** — trust is correct security DNA but onboarding cost is high; QuickPick copy is dense (“Confirm with none selected to revoke”).

**Also P1:** README example literally teaches `npx -y` while policy/trust plane treats unpinned `-y` as deny — new user will copy-paste the insecure pattern you later sell as the problem.

---

### T3 — Failure recover

| NN/g Q | Verdict | Notes |
|---|---|---|
| Right result? | **Strong** | Toast actions match JTBD: Reconnect / Reload / Quit / Mute. |
| Notice? | **OK** if notify ≠ `none`. Default `failures` — good. |
| Associate? | **Weak** | Overview now explains Reconnect vs Reload vs Quit — **only if she opens Overview**. Toast buttons are unlabeled beyond the verb; she still may pick wrong. |
| Progress? | **Critical honesty** | Reconnect = **Watchdog’s** client only. Cursor’s MCP host may still be dead until Reload. Honest README — but **first-time she will feel lied to** when Reconnect “succeeds” in Watchdog and agent still fails. |

**Priya:** “You said one-click Reconnect. I clicked it. Status went green. Agent still can’t call tools. I’m uninstalling.”

**Severity: P0 product-promise gap** — dual-truth is the real value, but UI does not **force** the dual-truth lesson at the moment of failure. Overview note is buried. Toast does not say “Watchdog healthy ≠ Cursor connected.”

---

### T4 — Trust / security

| NN/g Q | Verdict | Notes |
|---|---|---|
| Right result? | **Strong** intent | Fingerprint excludes env/header values (good). |
| Notice risks? | **Weak** | Prompt says “connects to them (stdio commands / HTTP URLs)” — does not show **command + args** until QuickPick label. Headers/env never shown (good) but also never “we never send secrets.” |
| Associate? | **OK** for security-minded; scary for juniors. |
| Progress? | **OK** after approve. |

**Priya:** “Fine. But Cloud bridge settings appeared in Settings with zero in-app story. Am I phone-home now?”

**Severity: P1** — `cloudBridge.enabled` default false + `usesOnlineServices` tag is correct; **no Settings UX explanation** that Cloud is optional OSS and separate. Looks like half-shipped enterprise.

---

### T5 — Cloud

| NN/g Q | Verdict | Notes |
|---|---|---|
| Right result? | **Fail for Priya day 1** | She doesn’t need cloud. |
| Notice? | **Docs-only** | `packages/cloud` not discoverable from Marketplace README top. |
| Associate? | **Confusing** | “Watchdog Cloud” vs extension name; EXECUTION/GTM are internal grade. Cloud README says `npm start` but no `npm install` in cloud package, no Docker, in-memory only, Postgres migration file unused. |
| Progress? | **Fail T3 self-host story** | Stranger cannot hit &lt;30 min confidently — missing compose, deps, auth, persistence. |

**Priya (if she peeks):** “This is a prototype bolted next to a real extension. Don’t put bridge settings in my IDE until Cloud is installable.”

**Severity: P0 for cloud narrative / P2 for Priya’s day-1 IDE path** (she can ignore it — unless Settings search surfaces scary “cloudBridge”).

---

## 4. Heuristic scores (GitLab 1–5)

| Heuristic | Score | One-line |
|---|---|---|
| Visibility of system status | **4** | Status bar + states are solid once running |
| Real-time UI | **4** | Probes + toasts; dual-truth not realtime in toast |
| User control / freedom | **3** | Mute/reconnect exist; trust revoke buried |
| Error recognition / recovery | **2** | Recover verbs exist; semantic gap Cursor vs Watchdog |
| Flexibility / efficiency | **3** | Per-server overrides; experts OK; novices slow |
| Minimal setup | **2** | Config path zoo + trust + activity bar discovery |
| Documentation easy to use | **3** | README long but honest; Marketplace shows placeholder GIF disclaimer (**own goal**) |
| Features communicate value | **2** | Description too small; Cloud/policy invisible or premature |
| Clear CTAs | **3** | Walkthrough CTAs good; failure toast CTAs ambiguous |
| Complex tasks guided | **2** | Multi-root, SSE vs HTTP, trust fingerprint — expert-only |
| Whole-team usable | **2** | Engineer-only; security buyer story unfinished |

**Average ≈ 2.7 / 5 (Below Average–Average).** IDE core when configured is closer to 3.5; **first 10 minutes drag the score down.**

---

## 5. Niche-by-niche roast (every piece)

### Marketplace / discovery
- Placeholder GIF **called out in published README** — looks unfinished.
- Description ignores “editor shows tools but MCP is dead” punchline.
- Dual channel (Open VSX vs Marketplace) is correct but cognitively expensive.

### Install / activation
- `engines.vscode ^1.105.0` — may confuse older Cursor forks (Priya doesn’t know engine mapping).
- `untrustedWorkspaces.supported: false` — correct, but Restricted Mode failure is silent confusion.

### Config surface
- Too many paths (Cursor / VS Code / Windsurf / Claude / globals / multi-root).  
- Example promotes `npx -y` — conflicts with policy story.

### Trust gate
- Good security. Bad first-run UX. QuickPick revoke-by-empty is clever and invisible.

### Status bar
- Best feature. Compact. Winning.

### Overview webview
- Metrics OK. Recover/dual-truth copy recently added — still **paragraph density**, not a diagram.
- No empty-state “Kill a server to see a toast” tutorial.

### Servers tree
- Fine for operators; no “this is Watchdog’s connection, not Cursor’s” column.

### Alerts / toasts
- Action set is powerful. Missing **education chip** on dual-truth.
- “Quit Cursor” on VS Code users is awkward (fallback message exists — still weird branding).

### Monitor / probe-core
- Solid engineering (REA: monitor + listTools + schema drift).  
- Schema drift invisible in UI severity for Priya — `schemaDrift` fields exist; Overview doesn’t shout breaking vs info.

### Bridge settings
- Premature in IDE Settings without Cloud GA + in-app explainer + SecretStorage token flow (token storage not fully wired in extension client).

### Watchdog Cloud
- Dashboard is a sketch (in-memory, no auth, no multi-tenant).  
- Calling it a product next to a mature extension invites harsh judgment.
- Policy evaluate API exists; no UI to manage allowlists for teams.

### Docs sprawl
- EXECUTION / GTM / spikes / validation — great for builders, **hostile as customer entry**. Marketplace should not feel like a research org.

---

## 6. Severity backlog (what to fix first)

| Sev | Finding | Fix direction |
|---|---|---|
| **P0** | Marketplace demo is labeled placeholder | Ship live kill→toast GIF; remove apology line |
| **P0** | Reconnect success ≠ Cursor MCP fixed | Toast + Overview: explicit dual-truth at failure time; suggest Reload when host may be stale |
| **P1** | First-run trust tax | Streamlined “Allow all for this workspace” primary; Advanced → per-server |
| **P1** | README teaches `npx -y` | Example with pinned version / `node ./server.js`; call out `-y` risk |
| **P1** | Activity bar discovery | Post-install command palette nudge + status bar click → Overview |
| **P1** | Cloud bridge settings early | Hide behind experimental flag or remove until Cloud T3 real |
| **P2** | Quit Cursor wording | Host-aware label (Quit editor) |
| **P2** | Schema drift not user-visible | Badge on Servers when breaking |
| **P2** | Cloud self-host incomplete | Docker compose + persistence before any marketing |
| **P3** | Docs for operators vs builders | Split “User guide” vs “Build/raise bible” |

---

## 7. Would Priya keep it?

**Conditional yes** — if status bar proves itself on a real flap in week one.  
**Uninstall triggers:** placeholder demo vibe, Reconnect “green lie,” trust friction before any value, accidental Cloud settings anxiety.

**Quote she’ll paste in Slack:**
> “Useful status bar, confusing product. It monitors its own connection, not Cursor’s — they should scream that. Fix the GIF and the Reconnect lie and I’ll recommend it.”

---

## 8. Evidence refs

- REA: `ev_2f0e3bc6bb27e51f62ebc06f8ca5f0f8ba4d0e10f88036332f98278c8dfe68f5` (src graph), summary view `ev_6da5a79a…`
- Walkthrough / views: `package.json` contributes.walkthroughs, viewsWelcome
- Trust: `src/extension.ts` `offerTrustPrompt` / `reviewTrustQuickPick`
- Marketplace description vs README Why mismatch
- Cloud: `packages/cloud/README.md` + in-memory `server.ts`

---

## 9. Method note (for next round)

Replace this inspection with **3–5 real Cursor users** (GitLab: 3–4 tasks, &lt;20 min unmoderated):  
(1) install, (2) open dashboard, (3) kill MCP, (4) recover. Measure task success ≥78% (MeasuringU baseline cited by GitLab). Until then, treat P0s above as non-negotiable.
