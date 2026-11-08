# Agent notes — MCP Watchdog

Open **ops** `docs/ops/STATUS.md` first (submodule or multi-repo cloud env with `mcp-watchdog-ops`).

## Cursor Cloud specific instructions

Full SoT: `docs/ops/CLOUD-AGENT-VERIFY.md` (private ops).

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

Point it at `.cursor/environment.json` (declares `repositoryDependencies` + `cloud-install.sh` which symlinks ops → `docs/ops`).  
Without that dashboard step, Cloud Agents **404** private ops — stubs only.  
Terminal: Watchdog Cloud on `:8787`.

### Cloud Agent must run

```bash
npm run lint && npm run format:check && npm run compile
npm run test:unit && npm run build && npm run test:host
# smoke when network + connect path touched
npm run smoke
```

Then **computer use**: inspect UI, attach screenshots/videos of what’s wrong (toast ≤3, cause sentences, dual-truth, no secret values). Claim stage **Now+**.

### Local IDE Agent chat

STATUS / GTM / Slack / small fixes only. For “test the product / what’s wrong,” **start a Cloud Agent** in the multi-repo env (or self-hosted Mac). Do not paste ops into public stubs. No spend.
