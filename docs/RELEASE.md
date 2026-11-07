# MCP Watchdog — Release train

**Last updated:** 2026-11-07  
**Role:** Staged publish so GTM has time and production does not absorb every Unreleased commit at once.  
**Progress board:** [STATUS.md](./STATUS.md). **QA evidence:** [TESTING.md](./TESTING.md). **Marketing sync:** [GTM-PUBLISH.md](./GTM-PUBLISH.md). **GTM role (Instinct):** [GTM-ROLE.md](./GTM-ROLE.md). **Guardrails / comms:** [GTM-GUARDRAILS.md](./GTM-GUARDRAILS.md) · [GTM-COMMS.md](./GTM-COMMS.md). **Claims:** [STRATEGY-THESIS.md](./STRATEGY-THESIS.md).

Agents land work under CHANGELOG `[Unreleased]` and **do not bump** `package.json` by hand. **Cadence** (below) or maintainer cuts the version. After an **announce-worthy** stable + G0, eng pings **Instinct** per [GTM-COMMS.md](./GTM-COMMS.md) with version + CHANGELOG bullets (soak window — GTM-ROLE operating rhythm). Cadence patches do **not** ping Instinct.

---

## Train rules

1. **One user-visible story per announce-worthy cut** — release map in [GTM-PUBLISH.md](./GTM-PUBLISH.md) (Doctor UI → hosts → verify → bake-off announce). Exact patch numbers may advance via cadence.  
2. **Do not** merge Doctor UI + verify + bake-off win into a single **announce** unless the maintainer explicitly re-scopes the map.  
3. **Soak between announce-worthy stables:** after Open VSX shows the version **and** G0 smoke passes, wait **≥3 calendar days** before the next **public announce**. Cadence patches may ship during soak; they are silent.  
4. **HostCapabilities / verify:** if no user-visible delta worth announcing, skip announce and fold notes — still test if tagged.  
5. Cursor ICP: **Open VSX first** for announce; Marketplace gets the **same VSIX**.

### 2-hour cadence patches

| | |
|--|--|
| Schedule | GitHub Actions [cadence-release.yml](../.github/workflows/cadence-release.yml) — `cron: 0 */2 * * *` (UTC) + `workflow_dispatch` |
| Script | [scripts/cadence-release.sh](../scripts/cadence-release.sh) |
| When it ships | `main` has **≥1 commit since last `v*` tag** **and** **CI green** on that SHA |
| What it does | Patch-bump `package.json` → `npm test` → tag → Marketplace + Open VSX + GitHub Release |
| What it does **not** | GTM/Instinct announce · Live EH SIGN-OFF · claim-ladder moves |
| Disable | Repo variable `ENABLE_CADENCE_RELEASE=false` (default **true**) |
| Optional | Secret `CADENCE_PUSH_TOKEN` (PAT) so tag push can also fire `release.yml`; otherwise cadence self-publishes |

Dry run locally: `CADENCE_DRY_RUN=1 SKIP_CI_WAIT=1 bash scripts/cadence-release.sh` (still mutates the working tree — discard or reset after).

---

## Stages per cut

```text
dev (Unreleased in tree)
  → RC (local vsce package + TESTING sign-off READY)
  → optional Marketplace --pre-release soak
  → stable tag + dual publish (Open VSX + Marketplace)
  → GTM announce (only if claim stage allows)
```

| Stage | Who | Exit criteria |
|-------|-----|----------------|
| **dev** | Agents / PRs | Unit + compile + build green for code; STATUS updated if position changed |
| **RC** | Maintainer | Packaged `.vsix`; [TESTING.md](./TESTING.md) Live EH + `SIGN-OFF.md` **READY**; GTM checklist drafted |
| **pre-release** | Maintainer (optional) | `vsce publish --pre-release` for soak; distinct version from next stable; not the Cursor announce |
| **stable** | Maintainer | Tag `vX.Y.Z`; `ship-release.sh` / release.yml; both registries show X.Y.Z |
| **announce** | **Instinct** (GTM) + Vaibhav | ≥3-day soak for announce-worthy cuts; claim stage matches STRATEGY; GIF if required; eng supplies capture on request |

---

## Hard gates before stable tag

Do **not** tag a user-visible cut until all apply:

- [ ] [STATUS.md](./STATUS.md) next actions agree this cut is next (not “ship everything”)  
- [ ] `npm run test:unit` · `npm run compile` · `npm run build`  
- [ ] **`npm run lint` · `npm run format:check`** (same as `ci.yml` lint job — Prettier failures are CI red)  
- [ ] `npm test` **or** documented subset: `smoke` + `test:host` when UI/Fix/verify changed (`npm test` includes lint + format:check)  
- [ ] `npx vsce package` + `vsce ls` — no `test/`, `*.local.md`, `launch/`, secrets, `.agents/`  
- [ ] **`bash scripts/check-no-secrets.sh`** — clean (no `xoxb-` / `AKIA` / `sk-live-` outside synthetic redact fixtures). Never commit `~/.cursor/mcp.json` or paste bot tokens into README/CHANGELOG/PRs  
- [ ] [TESTING.md](./TESTING.md) evidence: `docs/validation/release-evidence/vX.Y.Z/SIGN-OFF.md` = **READY**  
- [ ] CHANGELOG section for X.Y.Z + README/store deltas per [GTM-PUBLISH.md](./GTM-PUBLISH.md)  
- [ ] Claim-ladder stage for this version matches [STRATEGY-THESIS.md](./STRATEGY-THESIS.md) (no bake-off win before 0.6.0 announce)  
- [ ] Demo GIF updated if the failure→Fix→verify story changed ([media/GIF-RECORDING.md](./media/GIF-RECORDING.md))

### After push / tag (agents + maintainer)

- [ ] Wait for GitHub **CI** (`ci.yml`) **success** on the pushed SHA — not only `release.yml`.  
- [ ] `release.yml` green means publish path ran `npm test`; it does **not** replace watching `ci.yml` (matrix unit / host / lint).  
- [ ] Do not announce “shipped / done” to Vaibhav or Instinct while CI is red or in progress.

Helper: `bash scripts/wait-ci.sh` (watches the latest `CI` run for `HEAD` on `main`).

Docs-only tags are discouraged; if unavoidable, still run compile/unit and skip Live EH with an explicit SIGN-OFF skip reason.

---

## Cut calendar (current train)

| Version | Story | Announce soak | Notes |
|---------|-------|---------------|-------|
| **0.5.7** | Doctor UI Must | ≥3 days after G0 | Stage **first** — TESTING sign-off before tag |
| **0.5.8** | HostCapabilities | Skip announce if invisible | May fold into 0.5.9 notes |
| **0.5.9** | Verify + incidents | ≥3 days after G0 | GIF should show Verified beat |
| **0.6.0** | Bake-off win announce | ≥3 days after G0 | Eng pass already; marketing only when tagged |

Do not advance 0.6.0 announce until 0.5.7–0.5.9 are published (or explicitly folded by maintainer).

---

## Rollback

- **Never** unpublish a Marketplace/Open VSX version.  
- Ship a **patch** with the fix; hold or retract the **announce** if G0 fails.  
- If pre-release shows a regression, do not promote that build to stable until TESTING re-signs.

---

## Related

| Doc | Use |
|-----|-----|
| [STATUS.md](./STATUS.md) | Where we are / what cut is next |
| [TESTING.md](./TESTING.md) | Automated + live + capture gates |
| [GTM-PUBLISH.md](./GTM-PUBLISH.md) | Per-version marketing checklist |
| [../CHANGELOG.md](../CHANGELOG.md) | User-visible history |
| [../README.md](../README.md) | Ship checklist for maintainers |
