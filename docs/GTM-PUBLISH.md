# GTM / publish / media

Audiences, platforms, media, dual publish, marketing sync. Complements [EXECUTION.md](./EXECUTION.md).  
**Progress overview:** [STATUS.md](./STATUS.md) (published vs tree; next cut).  
**Release train / soak:** [RELEASE.md](./RELEASE.md) (≥3-day soak between announce-worthy stables; hard gates before tag).  
**QA sign-off:** [TESTING.md](./TESTING.md) (required `SIGN-OFF.md` for user-visible cuts).  
**Product claims:** [STRATEGY-THESIS.md](./STRATEGY-THESIS.md) claim ladder — do not advance marketing claims past earned stages.

## GTM owner (Instinct)

**Full role / RACI / reach + comprehension:** [GTM-ROLE.md](./GTM-ROLE.md) (developer-first PMM — **not** paid demand-gen ops).  
**Guardrails (HITL, banned claims, no-spend, attribution):** [GTM-GUARDRAILS.md](./GTM-GUARDRAILS.md).  
**How eng talks to Instinct:** [GTM-COMMS.md](./GTM-COMMS.md).  
**Outsider story kit:** [gtm/EXTERNAL-NARRATIVE.md](./gtm/EXTERNAL-NARRATIVE.md).

| Role | Owner |
|------|--------|
| Marketing / positioning / announce drafts / X–forum–HN / competitor narrative | **Instinct** ([GTM-ROLE.md](./GTM-ROLE.md)) |
| Product, docs, RELEASE/TESTING gates, GIF & screen capture when asked | Eng agent (Cursor) + Vaibhav |
| Version bump / tag / dual publish | Vaibhav (maintainer) |
| Money / buys / ads spend | **Vaibhav only** — eng never; eng must not instruct Instinct to spend |

**Channel:** Slack `#mcp-watchdog-gtm` preferred once live; until then iMessage with mandatory `[Cursor · MCP Watchdog eng]` prefix ([GTM-COMMS.md](./GTM-COMMS.md)). Instinct may request recordings, stills, or CHANGELOG bullets; eng follows [TESTING.md](./TESTING.md) / [media/GIF-RECORDING.md](./media/GIF-RECORDING.md) and never puts secret values in frames or drafts. Eng **never** auto-posts socially.  
**Claim hygiene still binds Instinct:** do not announce bake-off win or diagnose% until STRATEGY ladder + [RELEASE.md](./RELEASE.md) say that cut allows it. Tier 2+ needs Vaibhav packet A.

---

## Per-version marketing sync (required every cut)

Agents land work under **`CHANGELOG` `[Unreleased]`** and **do not bump** `package.json`. Maintainer cuts the version. For **each** published `x.y.z`, run this checklist in order (copy into a dated subsection under §D when executing).

| Step | Artifact | What to update |
|------|----------|----------------|
| 1 | [CHANGELOG.md](../CHANGELOG.md) | Move `[Unreleased]` bullets into `## [x.y.z] - YYYY-MM-DD`; keep Unreleased stub; fix compare links at bottom |
| 2 | [README.md](../README.md) | Only **user-visible** behaviour that changed (Install, Fix/Doctor copy, settings table, privacy). No thesis essays |
| 3 | `package.json` | `version` + Marketplace `description` / walkthrough if the store blurb must match the release |
| 4 | [docs/design/SCREEN-SPEC.md](./design/SCREEN-SPEC.md) / GIF | Re-record `images/demo.gif` **only** if the failure→Fix→verify story changed ([media/GIF-RECORDING.md](./media/GIF-RECORDING.md)) |
| 5 | Open VSX + Marketplace | After tag/`ship-release.sh`: listings show **x.y.z**; G0 smoke on **published** Cursor install (§B) |
| 6 | GitHub Release notes | Same bullets as CHANGELOG (no secret values; no bake-off **win** until thesis ladder allows) |
| 7 | Announce drafts | `launch/` (gitignored): short X/LinkedIn + longer forum/HN from §G template — rewrite for **this** version’s user-visible delta only |
| 8 | This file §D | Tick a new `### x.y.z` checklist; leave prior versions as history |

**Do not update for every Unreleased commit:** STRATEGY-THESIS, ARCH, BAKE-OFF method (update BAKE-OFF **results** only when a dated run lands). Marketing surfaces = CHANGELOG + README + store blurb + GIF + announce — not the full SoT tree.

**Claim hygiene (every announce):**

- Allowed now: independent probe, guided Fix, honest host Unknown, Doctor cause copy when shipped.
- Forbidden until earned: “bake-off win,” diagnose%/resolve% numbers, “best at recovery,” auto-heal without verify, host healthy when Unknown.

## Release map (locked — SemVer patch line 0.5.x)

One **user-visible product story per cut**. Do not merge Doctor UI + verify + bake-off win into a single patch unless the maintainer explicitly re-scopes. Agents code under `[Unreleased]`; maintainer assigns the version when tagging.

| Version | Scope (eng) | CHANGELOG / README / store must mention | Claim-ladder stage after announce | GIF? | Gate before tag |
|---------|-------------|-----------------------------------------|-----------------------------------|------|-----------------|
| **0.5.7** | Doctor UI Must ([tasks/todo.md](../tasks/todo.md): cause sentences, toast ≤3, Overview footer/metric, status tooltip, Fix QP; catalog unit gaps) | Doctor cause-first copy; toast action cap; SCREEN-SPEC S-* user-visible deltas only | **Now+** (diagnose copy improved; still no bake-off win) | Re-record if toast/Fix story frame changes | [RELEASE](./RELEASE.md) gates + [TESTING](./TESTING.md) `v0.5.7` SIGN-OFF READY |
| **0.5.8** | Phase 2 thin `HostCapabilities` (cursor/vscode/windsurf) if user-visible (restart availability honesty) | Host-honest restart / Unknown when commands missing | **Now+** | No unless status-bar copy changes | RELEASE + TESTING if tagged; Cursor still Unknown for session |
| **0.5.9** | Phase 3 verified recovery + `.mcp-watchdog/incidents.jsonl` + Overview `S-VERIFY-01` | Post-Fix verified / unresolved / worsened; local incident note (no secret values) | **Now+** (verified-resolve measurable locally; no public %) | Yes if verify line is in the demo clip | RELEASE + TESTING `v0.5.9` SIGN-OFF; redaction check |
| **0.6.0** | Announce bake-off win (eng pass already: [phase3 re-bake](./validation/bake-off/RUN-2026-11-07-phase3-rebake.md) **35/36**) | Cite dated bake-off method + totals; “outperformed named alternatives on controlled scenarios” | **After bake-off win** | Optional still of score table (HTTPS asset) | Prior cuts published (or folded); RELEASE soak; TESTING if code changed |
| **Later 0.6.x+** | Phase 6 harness CLI / diagnose% disclosure | Separate minors; public % only with FP disclosure | **After measured diagnose%/resolve%** when instrumented | As needed | Thesis formulas + labeled window |

If 0.5.8 has **no** user-visible delta (adapters only), skip announce and fold into 0.5.9 notes — still bump only when publishing.

**0.5.7 listing copy** is drafted in [gtm/LISTING-DRAFT-0.5.7.md](./gtm/LISTING-DRAFT-0.5.7.md). It is not applied to `package.json`, the README lead, or `images/demo.gif` while the 0.5.7 sign-off is **HOLD**.

### Notes template (paste into CHANGELOG `## [x.y.z]` body)

```markdown
### Added / Changed / Fixed
- <user-visible Doctor/verify/host bullets only>

### Marketing
- Claim stage: Now+ | bake-off win | measured % (pick one)
- G0 platforms smoked: Cursor Open VSX | VS Code Marketplace | …
- GIF updated: yes/no
```

---

## GTM cadence improvements (2026 extension trends)

Evidence: Marketplace/Open VSX dual-publish remains mandatory for Cursor ([Cursor Open VSX](https://forum.cursor.com/t/extension-marketplace-changes-transition-to-openvsx/109138)); README+CHANGELOG **are** the store page; same VSIX both registries; HTTPS images only; Open VSX first for our ICP.

| Practice | How we apply it each cut |
|----------|---------------------------|
| **Open VSX = primary ICP channel** | Announce Open VSX install link first; Marketplace second ([README](../README.md) already orders this) |
| **Same VSIX both stores** | `ship-release.sh` / `release.yml` — never drift versions between registries |
| **README is the landing page** | Lead with one job (“see why MCP failed → Fix”); GIF in first screen; settings table; link CHANGELOG |
| **CHANGELOG shows shipping cadence** | Every tagged release gets a dated section — empty “marketing-only” tags forbidden |
| **Keywords / description** | `package.json` description uses operator search language (`MCP`, `reconnect`, `Cursor`, `failed`) — not moat slogans |
| **Trust** | Public `repository` + LICENSE; no SVG user images in README; no secret values in notes |
| **One honest post > spray** | §G short + long templates; Cursor forum / GitHub Discussions over generic SEO spam |
| **Claim ladder** | Announces must match [STRATEGY-THESIS.md](./STRATEGY-THESIS.md) stage for that version (table above) |

Revisit this section when Cursor marketplace policy or Open VSX verification badges change.

---

## A. Audiences

| Audience | Surface | Proof asset |
|---|---|---|
| Operator (PLG) | IDE (Cursor first) | Failure toast → **Accept** / **Fix…** / **Remove** / Retry probe |
| Author | Watchdog Cloud (preview) | Dual-truth bridge + Add Server dialog |
| Team / security | Configuration policy checks | Allow or deny, audit trail, outside the tool-call path |
| Self-host | OSS cloud README | T3 &lt;30 min |
| Investor | Local probe vs Cloud probe | Opt-in bridge posts names-only; dual-truth is honest |

---

## B. Platform smoke (G0) — every RC

| Platform | Channel | Pass criteria | Date / result |
|---|---|---|---|
| Cursor | Open VSX | Install → reload → activity bar → fail → Accept/Fix | _after 0.5.4 listing_ |
| VS Code | Marketplace | Same | _after 0.5.4 listing_ |
| Windsurf / VSCodium | Open VSX | Install + status bar | _after 0.5.4 listing_ |
| Airgap | GitHub `.vsix` | Install from VSIX | Release asset `v0.5.4` |
| Watchdog Cloud | Self-host | Dashboard + bridge POST | Host E2E green |

Use the platform’s real MCP config path (see README).

---

## C. Media (G1)

| Asset | Path | Status |
|---|---|---|
| Demo GIF | `images/demo.gif` | Shipped in README; re-record Accept story when ready ([GIF-RECORDING.md](./media/GIF-RECORDING.md)) |
| Cloud stills | `docs/validation/triage-evidence/stills/V-CL-*.png` | V-CL-01…04 captured |

---

## D. Marketing sync history (G2)

Use the **Per-version marketing sync** table above for every new cut. History:

### 0.5.6 (shipped)

- [x] CHANGELOG / README / dual publish (see repo tag `v0.5.6`)

### 0.5.5

- [x] CHANGELOG.md dated `0.5.5` (product telemetry default on)
- [x] README Privacy + `telemetry.enabled` + Cloud bridge
- [x] package.json description (PostHog honesty) + walkthrough Watchdog chip
- [x] Version `0.5.5`
- [ ] Announce draft after PostHog project key is set and tag `v0.5.5` publishes

### 0.5.4

- [x] CHANGELOG / README Accept/Fix/Remove + Cloud bridge
- [x] Dual-published Marketplace + Open VSX

---

## E. Dual publish (G3)

Workflow: `.github/workflows/release.yml` on tag `v*`.

1. Set PostHog project API key + matching-region host in `src/telemetry/config.ts`  
2. Tag `v0.5.5` → push  
3. `vsce package` → GitHub Release + `.vsix`  
4. VS Marketplace if `VSCE_PAT` set  
5. Open VSX if `OVSX_PAT` set (Cursor primary)  
6. Soft-skip if PAT empty — verify listing before claiming published  
7. Confirm one `activation` in PostHog Live events from a real install  

Item: `mcp-watchdog.mcp-watchdog`.

Evidence / handoff: [validation/triage-evidence/PUBLISH-HANDOFF.md](./validation/triage-evidence/PUBLISH-HANDOFF.md).

---

## F. Watchdog Cloud story (G4)

- Opt-in `cloudBridge.enabled` posts names-only incidents including `accepted`.
- Dual-truth compares IDE bridge state with Cloud’s own poll — not the editor MCP client.
- Product telemetry (PostHog) is separate — default on; not Cloud dual-truth.
- Assets: `V-CL-*` stills in triage-evidence.

---

## G. Post-release (G5)

1. Confirm Open VSX + Marketplace show **this** `x.y.z` (same build)  
2. Re-run G0 on **published** Cursor install (not F5) — Open VSX first  
3. Outreach — rewrite from CHANGELOG user-visible bullets only; enforce claim stage from release map  

**X / LinkedIn (short) template:**  
MCP Watchdog x.y.z — \<one user-visible delta\>. Independent MCP probe + guided Fix; host Unknown when we can’t see the editor session. Install: Open VSX (Cursor) / Marketplace (VS Code).

**HN / forum (longer) template:**  
Lead with the failure→cause→Fix story for this cut. Dual-truth: Watchdog probe ≠ editor MCP health. Link Open VSX + CHANGELOG. Do not claim bake-off win or diagnose% unless this version’s claim stage allows it (see release map).
