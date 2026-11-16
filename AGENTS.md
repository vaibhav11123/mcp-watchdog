# Agent notes — MCP Watchdog

Open **ops STATUS** first (plan of action / Progress train / Growth order):

| Where you are | Open |
|---------------|------|
| **Local Mac** (submodule linked) | `docs/ops/STATUS.md` |
| **Cloud Agent** (after `cloud-install.sh`) | `docs/ops/STATUS.md` (symlink → ops clone) |
| **Cloud Agent fallback** if `docs/ops/` empty | `/agent/repos/mcp-watchdog-ops/STATUS.md` |

Do **not** look for Desktop paths (`/Users/…`) from a Cloud VM.

**Path roots (same files):** `docs/ops/<file>` after link · else `/agent/repos/mcp-watchdog-ops/<file>`

### Supporting docs Cloud Agents need

| Need | File (under ops root) |
|------|------------------------|
| Plan / Growth order / next actions | `STATUS.md` |
| How to verify in Cloud | `CLOUD-AGENT-VERIFY.md` |
| Live EH / SIGN-OFF / capture | `TESTING.md` |
| Soak / publish gates | `RELEASE.md` · `GTM-PUBLISH.md` |
| Claims / ICP | `STRATEGY-THESIS.md` |
| Doctor UI / cause | `design/SCREEN-SPEC.md` · `design/CAUSE-CATALOG.md` |
| Eng checklist | `tasks/todo.md` |
| Instinct / Slack | `GTM-ROLE.md` · `GTM-COMMS.md` · `GTM-GUARDRAILS.md` |
| Dual-repo rules | `DUAL-REPO.md` |
| Public stubs only (no private process) | repo `docs/STATUS.md`, `docs/OPS.md`, `README.md`, `CHANGELOG.md` |

## Cursor Cloud specific instructions

Full SoT: `docs/ops/CLOUD-AGENT-VERIFY.md` — or `/agent/repos/mcp-watchdog-ops/CLOUD-AGENT-VERIFY.md` if unlinked.

### Default: verify in a Cloud Agent environment

From now on, **automated tests + product lookchecks run in a Cloud Agent environment**, not midwifed in a local IDE chat.

| Worker | Role |
|--------|------|
| **Cursor-hosted Ubuntu** (default) | lint / unit / host / smoke + computer-use artifacts |
| **Self-hosted Mac** (optional) | Same agent loop, tools on your Mac — for real Cursor F5 Live EH / GIF |

Both are cloud agents. Self-hosted Mac = Cloud Agent worker, not “local Agent chat.”

### Required environment (ops docs)

Vaibhav must create a **multi-repo** Environment in [cursor.com/agents](https://cursor.com/agents) with:

1. `vaibhav11123/mcp-watchdog`  
2. `vaibhav11123/mcp-watchdog-ops`  

Point it at `.cursor/environment.json` (declares `repositoryDependencies` + `cloud-install.sh` which symlinks ops → `docs/ops`, including `/agent/repos/mcp-watchdog-ops`).  
Without that dashboard step, Cloud Agents **404** private ops — stubs only. If Build ran but `docs/ops/` is still empty, read STATUS at **`/agent/repos/mcp-watchdog-ops/STATUS.md`** and re-run `bash .cursor/cloud-install.sh`.  
Terminal: Watchdog Cloud on `:8787`.

### Cloud Agent must run

```bash
npm run lint && npm run format:check && npm run compile
npm run test:unit && npm run build && npm run test:host
# smoke when network + connect path touched
npm run smoke
```

Then **computer use**: inspect UI, attach screenshots/videos of what’s wrong (toast ≤3, cause sentences, dual-truth, no secret values). Claim stage **Now+**.

### CI contract (merge-ready)

Local Cloud Ubuntu green is **not** merge-ready by itself. GitHub Actions must pass the single required gate job named **CI** (see `.github/workflows/ci.yml`).

- Any new CLI / spawn / shell script path must also pass `unit (windows-latest)` (PowerShell does not expand bash globs).
- Prefer vitest directory filters or config `include` over unquoted shell globs (`cli-*.test.ts`, brace expansion) in `package.json` scripts that CI runs.
- Do **not** re-add required `macos-latest` to the unit matrix until hosted macOS capacity is reliable (actions/runner#4833). Optional Darwin live coverage belongs in a separate job excluded from the gate `needs`.
- Prefer rebasing feature branches onto `main` after CI durability merges; avoid parallel fix forks of the same train.
- Keep `ENABLE_CADENCE_RELEASE=false` until intentional.

### Local IDE Agent chat

STATUS / GTM / Slack / small fixes only. For “test the product / what’s wrong,” **start a Cloud Agent** in the multi-repo env (or self-hosted Mac). Do not paste ops into public stubs. No spend.
