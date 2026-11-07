# Listing draft — 0.5.7

**Status:** Draft for review. Not applied.  
**Claim stage:** **Now+**  
**Do not ship in this file:** bake-off win, diagnose%, resolve%, auto-heal, or “host is healthy” while the editor session is Unknown.  
**Live surfaces left unchanged:** `package.json` `description`, README lead, `images/demo.gif`.  
**Sign-off:** [v0.5.7/SIGN-OFF.md](../validation/release-evidence/v0.5.7/SIGN-OFF.md) is **HOLD**. Published listing is **0.5.6**.

Apply the three strings below only after Vaibhav approves them. Nothing else in the listing changes in that pass.

Research used to size the strings (2026-11-07):

- The Marketplace `description` is the short line for the gallery and for in-product search ([Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest)). The Extensions sidebar shows that one line under the name, before anyone opens the README.
- Open VSX and the Marketplace read the same packaged manifest, so one description serves both listings.
- A walkthrough step should keep a verb action ([Walkthroughs](https://code.visualstudio.com/api/ux-guidelines/walkthroughs)). The status-bar step already links `mcpWatchdog.showStatus`; the draft keeps that link.

The current `description` is 228 characters. It leads with status, latency, Accept / Fix… / Remove, Cloud, and telemetry, and it never says a green row is Watchdog’s own connection. Telemetry disclosure stays in the README [Privacy & data](../../README.md) section. It does not need to compete with the sidebar line.

---

## 1. Store `description`

Replace `package.json` `description` with:

```text
Know which MCP servers are responding in Cursor and VS Code. Green is Watchdog's own connection, not the editor session.
```

121 characters. Names Cursor and VS Code because that field is searched. Says what the check does, then the dual-truth limit.

---

## 2. README headline

Replace the bold lead under the badges:

```markdown
**Know which MCP servers are responding — independent of what the editor still shows.**
```

This is the one-liner already in [EXTERNAL-NARRATIVE.md](./EXTERNAL-NARRATIVE.md). The next paragraph already says the editor can still show tools after a server has gone quiet, and that Watchdog is an independent check.

---

## 3. Walkthrough status-bar step

In `package.json` → `contributes.walkthroughs` → step `statusBar`, replace the description with:

```markdown
When servers are monitored, the bottom-right status bar shows **Watchdog: healthy/total**. That count is Watchdog’s own connection, not the editor’s MCP session.

[Show server status](command:mcpWatchdog.showStatus)
```

One sentence for the distinction. The command link stays so the step still has an action.

---

## Recording

Do not replace `images/demo.gif` until Live EH is signed off. Shot list: [GIF-RECORDING.md](../media/GIF-RECORDING.md).

| Beat | In this draft’s 0.5.7 clip? | Where it actually is |
|------|-----------------------------|----------------------|
| Healthy chip | Yes, when recorded | Working tree |
| Failure, cause sentence, toast ≤3 (**Fix…** / **Show Log** / **Mute 1h**) | Yes, when recorded | Working tree for **0.5.7**. Not in the published **0.5.6** listing. |
| Overview row with **Editor session: Unknown** | Yes, when recorded | Working tree for **0.5.7**. Not in the published **0.5.6** listing. |
| **Fix…** Quick Pick | Yes, when recorded | Working tree for **0.5.7** |
| Overview **Verified:** | No | **0.5.9** beat. L7 on the 0.5.7 sign-off is skipped for that reason. |

Caption the clip as a tree recording of the Doctor UI, not as the published 0.5.6 demo.

---

## Release-gate status

Copied from the sign-off. Not a new test run.

| Item | State |
|------|--------|
| Ship decision | **HOLD** |
| Published version | **0.5.6** |
| Commit the sign-off names | `23f563c` (re-check before tag) |
| `npm run test:unit` | 235 passed (2026-11-07) |
| `npm run compile`, `npm run build`, `npm run smoke`, `npm run test:host` | Green (host 9/9) |
| `bash scripts/check-no-secrets.sh` | OK |
| Live EH L1–L6, L8–L9 | Pending |
| L7 Fix → verify | Skip until **0.5.9** |
| Clean-profile VSIX install and G0 smoke | Pending. A `.vsix` was built from the tree; version bump is still the maintainer’s at tag. |
| GIF | Pending |

Blockers before **READY**: Live EH on F5 **Run Extension (mcp-watchdog-test workspace)**, install the packaged VSIX in a clean Cursor profile, optional stills, then re-run the secret scan and unit/compile/build on the tag SHA.
