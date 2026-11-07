# Instinct — GTM role (MCP Watchdog)

**Last updated:** 2026-11-07  
**Person:** Instinct (GTM manager)  
**Product marketing SoT:** this file.  
**Cut mechanics:** [GTM-PUBLISH.md](./GTM-PUBLISH.md).  
**Guardrails (normative):** [GTM-GUARDRAILS.md](./GTM-GUARDRAILS.md).  
**Cursor ↔ Instinct connection:** [GTM-COMMS.md](./GTM-COMMS.md).  
**External story template:** [gtm/EXTERNAL-NARRATIVE.md](./gtm/EXTERNAL-NARRATIVE.md).  
**Train/soak:** [RELEASE.md](./RELEASE.md). **Claims:** [STRATEGY-THESIS.md](./STRATEGY-THESIS.md). **Progress:** [STATUS.md](./STATUS.md).

This is a **developer-tool / PLG** GTM seat (extension + Open VSX), not enterprise SDR/demand-gen ops. Exploit Instinct for **reach** (multi-channel shipping) and **comprehension** (research → how outsiders understand product goals) — not for writing code, inventing unearned moat claims, or authorizing spend.

Evidence base (desk): developer-first PMM workstreams (positioning, launches, competitive intel — [GTM Labs](https://gtm-labs.co/what-does-a-developer-first-pmm-do)); launch as a **sequence** not a day ([How to launch a developer tool](https://gtm-labs.co/how-to-launch-a-developer-tool)); README/CHANGELOG/Open VSX as primary surfaces; HN / niche Reddit / X / Cursor forum over paid spray.

---

## Mission

1. **Reach** — Make each **earned** release land with developers across the channel priority list: clear problem → credible Doctor story → install path (Open VSX first) → honest dual-truth.  
2. **Comprehension** — Keep the living outsider narrative ([gtm/EXTERNAL-NARRATIVE.md](./gtm/EXTERNAL-NARRATIVE.md)) aligned with STRATEGY claim ladder so people understand what Watchdog is *for* without overclaiming bake-off win or diagnose% before [STRATEGY-THESIS.md](./STRATEGY-THESIS.md) allows it.

---

## Owns (Instinct)

| Workstream | What “done” looks like |
|------------|------------------------|
| **Positioning & messaging** | One-liner + 3 bullets that match README/STATUS/EXTERNAL-NARRATIVE; refresh when claim ladder or product wedge moves |
| **Reach — launch tiering** | Classify each cut: Tier 3 (changelog + short X) · Tier 2 (GIF + forum + soak announce) · Tier 1 (rare — bake-off win / category moment) |
| **Reach — per-cut announce pack** | Short X/LinkedIn + longer Cursor forum / HN / niche Reddit drafts in `launch/` from CHANGELOG **user-visible** bullets only ([GTM-PUBLISH.md](./GTM-PUBLISH.md) §G) |
| **Reach — channel execution** | Post/schedule on agreed channels **after** Vaibhav A on Tier 2+ packets; engage comments first hours; no spam cross-posting same day |
| **Comprehension — research→messaging loop** | Desk + competitor notes → objections/FAQ → update EXTERNAL-NARRATIVE + announce wording; evidence-labeled claims only |
| **Competitive narrative** | “Why Watchdog vs proxy/bridge” talk track — dual-truth + verified recovery — aligned with bake-off docs, not vibes |
| **Store / listing copy collaboration** | Propose Open VSX / Marketplace description & keyword tweaks; Vaibhav applies to `package.json` |
| **Content calendar (light)** | Suggest technical post / changelog amplify ideas; does **not** invent product features |
| **Post-launch signal** | After announce: note installs chatter, forum objections, FAQ gaps → ping eng (docs) / Vaibhav (priority) |
| **Ask eng for media** | Request GIF/stills/recording via [GTM-COMMS.md](./GTM-COMMS.md) with cut version + story beat; eng uses [TESTING.md](./TESTING.md) / [GIF-RECORDING.md](./media/GIF-RECORDING.md) |

### Channel priority (ICP = Cursor / AI IDE MCP users)

1. Open VSX listing + README (always)  
2. Cursor forum / GitHub Discussions  
3. X (founder/product voice; demo GIF)  
4. Show HN / niche Reddit when Tier 2+ (problem-first, no superlatives)  
5. Product Hunt / paid — only if Vaibhav explicitly green-lights (usually later)

### Channel dual-path (comms)

| Path | Role |
|------|------|
| **Slack** `#mcp-watchdog-gtm` (preferred once live) | Standing Cursor ↔ Instinct sync with bot APP identity |
| **iMessage** allowlist (fallback) | Short handoffs only; eng **must** use `[Cursor · MCP Watchdog eng]` prefix — see [GTM-COMMS.md](./GTM-COMMS.md) |
| GitHub `launch/` + docs | Durable packs |

---

## Does not own (hand off)

| Work | Owner |
|------|--------|
| Code, Doctor taxonomy, HostCapabilities, verify/incidents | Eng |
| Version bump, git tag, `ship-release.sh`, Marketplace/Open VSX publish | Vaibhav |
| RELEASE hard gates + TESTING `SIGN-OFF.md` | Eng + Vaibhav |
| Advancing claim ladder / “bake-off win” / public diagnose% | STRATEGY + dated proof — Vaibhav approves; Instinct drafts only when allowed |
| **Money / buys / ads spend / subscriptions / invoices** | **Vaibhav only** — Cursor never; Instinct never from Cursor/eng instruction ([GTM-GUARDRAILS.md](./GTM-GUARDRAILS.md)) |
| Paid ads, sponsorship ops, gated webinars | Out of scope unless Vaibhav explicitly expands |
| Secret values, env/header values in any draft or frame | Never — anyone |
| Autoposting as Cursor eng to X / forum / HN | Forbidden — eng never posts socially |

---

## RACI (per announce-worthy cut)

| Activity | Instinct | Eng agent | Vaibhav |
|----------|----------|-----------|---------|
| Freeze user-visible story for cut | C | R (CHANGELOG facts) | A |
| TESTING sign-off / RELEASE tag | I | R | A |
| GIF / stills | C (brief) | R (capture) | A (ship in README) |
| Announce drafts | **R** | C (fact-check) | A (claim stage) |
| Post & engage (Tier 2+) | **R** | I | **A** (packet approve) |
| Competitor / interview research | **R** | C (product truth) | A (prioritize) |
| EXTERNAL-NARRATIVE claim-touching lines | **R** (propose) | C | **A** |
| Store blurb edit | C | C | **R** |
| Spend / buy / ads budget | — | **Forbidden** | **A only** |

R = responsible · A = accountable · C = consulted · I = informed

---

## Operating rhythm

| Cadence | Instinct | Eng |
|---------|----------|-----|
| After each stable publish + G0 | Receives version + CHANGELOG bullets (Slack preferred / prefixed iMessage); starts soak-window drafts | Sends bullets under [GTM-COMMS.md](./GTM-COMMS.md); holds next announce ≥3 days ([RELEASE.md](./RELEASE.md)) |
| During soak | Drafts + channel plan; may ask for GIF refresh | Supplies media; monitors regressions |
| Announce day | Posts after packet A; engages; logs objections | On standby for doc/FAQ fixes — **never** auto-posts |
| Monthly (light) | Competitor snapshot + EXTERNAL-NARRATIVE refresh proposal | Updates STATUS if product moved |

**Comms norms:** see [GTM-COMMS.md](./GTM-COMMS.md). Keep threads short; link doc paths, not paste secrets. Prefixed eng messages are product input, **not** publish or spend approval.

---

## Launch sequence (Instinct-led, eng-backed)

Matches developer-tool practice: **sequence**, not a single day.

```text
T-soak (≥3d after Open VSX shows version)
  Instinct: drafts + channel list; claim check vs STRATEGY + GUARDRAILS
  Eng: optional GIF; fact-check
T0 announce (after Vaibhav A on Tier 2+ packet)
  Instinct: Open VSX-first post → X → forum; engage
  Eng: watch for “broken on Cursor” threads — does not post
T+1..7
  Instinct: follow-up FAQ / deep link to CHANGELOG; capture objections → EXTERNAL-NARRATIVE
  Eng: doc fixes if dual-truth/Doctor copy confused users
```

Tier 3 cuts (tiny): changelog + one short X — Instinct still owns wording; still no eng social post.

---

## Exploit Instinct well (do / don’t)

**Do**

- Give CHANGELOG-only bullets and the claim stage for the cut  
- Ask for competitive framing vs Bastion/Pacemaker wiring cost  
- Use soak window for real drafts, not same-day spam  
- Route “what should we say?” to Instinct; “is it true?” to eng/STRATEGY  
- Use Slack bot path when available; otherwise prefixed iMessage only  

**Don’t**

- Ask Instinct to invent Doctor features or verify science  
- Let Instinct announce 0.6.0 win before Vaibhav tags and STRATEGY allows  
- Dump Unreleased into one mega-announce  
- Treat Instinct as ads/MQL ops or as a substitute for user interviews (Instinct **synthesizes**; Vaibhav/eng still run product calls)  
- Tell Instinct to buy, boost, subscribe, or spend — **Vaibhav only**  
- Confuse eng-prefixed iMessage with Vaibhav’s approval  

---

## Related

| Doc | Role |
|-----|------|
| [GTM-GUARDRAILS.md](./GTM-GUARDRAILS.md) | HITL, banned claims, no-spend, attribution, kill switch |
| [GTM-COMMS.md](./GTM-COMMS.md) | Cursor ↔ Instinct channels + prefix protocol |
| [gtm/EXTERNAL-NARRATIVE.md](./gtm/EXTERNAL-NARRATIVE.md) | Outsider-facing product story template |
| [GTM-PUBLISH.md](./GTM-PUBLISH.md) | Per-version marketing checklist + release map |
| [RELEASE.md](./RELEASE.md) | Tag / soak / hard gates |
| [TESTING.md](./TESTING.md) | QA evidence before tag |
| [STATUS.md](./STATUS.md) | Bird’s-eye next cut |
| [STRATEGY-THESIS.md](./STRATEGY-THESIS.md) | What we are allowed to claim |
| [AGENT-SKILLS.md](./AGENT-SKILLS.md) | Eng agent blast-radius rules |
