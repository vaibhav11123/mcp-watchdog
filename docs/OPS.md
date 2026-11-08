# Dual-repo setup (public ↔ private ops)

MCP Watchdog uses **two** GitHub repos that work together:

| Repo | Visibility | Job |
|------|------------|-----|
| [mcp-watchdog](https://github.com/vaibhav11123/mcp-watchdog) | **Public** | Product code, Marketplace/Open VSX, README / CHANGELOG / LICENSE |
| [mcp-watchdog-ops](https://github.com/vaibhav11123/mcp-watchdog-ops) | **Private** | Process SoT — STATUS, GTM, validation evidence, launch packs, thesis/architecture working copies |

**Link:** git submodule `docs/ops/` in this repo → `mcp-watchdog-ops`.

```text
Public (this repo)                    Private (ops)
README / CHANGELOG / src              STATUS · GTM · validation · launch
docs/OPS.md  (this file)              STRATEGY · RELEASE · TESTING · design
docs/STATUS.md (stub) ──► points to   docs/ops/STATUS.md
docs/ops/  ◄── submodule ───────────  mcp-watchdog-ops @ pinned SHA
```

Full operating model (edit paths, Instinct access, CI, cadence):  
**`docs/ops/DUAL-REPO.md`** after you init the submodule.

---

## Checkout

```bash
git clone https://github.com/vaibhav11123/mcp-watchdog.git
cd mcp-watchdog
git submodule update --init docs/ops   # requires collaborator access on mcp-watchdog-ops
```

Without ops access: public clone still builds and tests; stubs under `docs/` explain where the full docs live.

---

## What lives where (short)

**Public:** extension source · tests · CI · store listing assets · README/CHANGELOG · thin stubs · this file.

**Private ops:** full STATUS · GTM-COMMS/ROLE/GUARDRAILS/PUBLISH · `gtm/` drafts · `validation/` SIGN-OFF · `launch/` · `tasks/` · `spikes/` · `design/` · STRATEGY / ARCH / BAKE-OFF / RELEASE / TESTING · research notes.

**Rule:** if you only need it to *use or contribute to the extension*, keep it public. Everything else → ops.

---

## How updates flow

1. **Product code / version / VSIX** → commit on **public** `mcp-watchdog` (CI here).
2. **Process / GTM / SIGN-OFF / STATUS** → commit on **private** `mcp-watchdog-ops`.
3. Optionally bump the submodule pointer on public so eng shares the same ops SHA:

```bash
cd docs/ops && git pull && cd ../..
git add docs/ops && git commit -m "Bump ops submodule." && git push
```

4. **Do not** copy full process docs back into public stubs — stubs stay one-screen redirects.
5. **Instinct / Vaibhav:** Slack for eng↔GTM product truth; iMessage for OWNER A / spend; invite Instinct’s **GitHub user** to the **private** repo once. Full Instinct dual-repo flow (when Vaibhav is / isn’t needed): **`docs/ops/INSTINCT-DUAL-REPO-FLOW.md`**.

CI on public **does not** recurse the private submodule. Marketplace packaging already excludes `docs/**`.

---

## Stubs you’ll see in this tree

Examples: `docs/STATUS.md`, `docs/GTM-*.md`, `docs/RELEASE.md`, `docs/gtm/README.md`, `docs/validation/README.md` — each points at `docs/ops/…`.

Historical public note: [TECHNICAL.md](./TECHNICAL.md) may remain; working architecture SoT is in ops.

**History:** older process files may still exist in this repo’s git history until a rewrite. Ops is SoT going forward.
