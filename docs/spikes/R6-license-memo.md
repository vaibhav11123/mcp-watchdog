# Spike R6 — License / hyperscalers memo

**Status:** researched (2026-10-30)  
**Plan lock:** **MIT + CLA now**; paid = **hosted convenience later**; revisit AGPL/BSL only if cloned  

**Current repo:** [LICENSE](../../LICENSE) is already **MIT** (“Copyright (c) 2026 MCP Watchdog contributors”).

## Industry patterns (study, not copy)

| Example | Move | Lesson |
|---|---|---|
| Elastic / Redis / Mongo | Permissive → SSPL / source-available / AGPL options | Land-grab then defend managed hosting |
| HashiCorp | MPL → **BSL** | Forbids competitive hosted offering; **not** OSI “open source” |
| Grafana / Plausible / MinIO | **AGPL** | Still OSS; network copyleft pressures modifiers who host |
| OpenSearch / OpenTofu / Valkey | Community forks after relicensing | **CLA** and contributor provenance matter before any future change |
| PLG / COSS playbooks | Charge for hosted ops while code stays open | Crippling free core kills community |

## Our lock (until counsel)

| Topic | Decision |
|---|---|
| Default license for IDE + cloud + probe-core | **MIT** |
| Contributor agreement | Add **CLA** (or DCO + CLA hybrid) **before** external cloud PRs scale |
| What we sell later | **Hosted run** of the same OSS (ops, Slack/PagerDuty wiring, multi-tenant SaaS), support — **not** a closed binary of core algorithms |
| What we do **not** do now | Relicense to AGPL/BSL “just in case”; paywall handshake/diff logic |
| Hyperscaler clone risk | Accepted for land-grab; if AWS-class clone appears, **revisit with counsel** (AGPL/BSL/SSPL-class options) — do not pre-emptively poison OSS adoption |

## CLA checklist (implement soon)

1. Choose CLA text (individual + entity) or Apache-style ICLA/CCLA.  
2. CLA assistant or GitHub Action on PRs.  
3. Document in CONTRIBUTING.md: MIT outbound; contributions under CLA.  
4. Do **not** accept large donated code without provenance review.

## Paid boundary (name before public cloud launch)

Even if charging starts later, write the boundary now:

| Free (OSS / self-host) | Paid (our hosted) |
|---|---|
| Extension, probe-core, self-host cloud via README | Managed multi-tenant cloud, SLA, SSO later, managed Slack/PagerDuty, support |
| Local bridge dry-run | Hosted bridge ingestion + retention |
| Policy plane rules as code | Hosted org policy console + audit export |

## Decisions locked

- No license change in this spike.  
- MIT remains; CLA is the next legal hygiene item.  
- Marketing may say “open source (MIT)” — never “BSL” or “source available” unless we actually relicense.

## Next action

Draft CLA + CONTRIBUTING blurb in a follow-up PR; no code license file change required now.
