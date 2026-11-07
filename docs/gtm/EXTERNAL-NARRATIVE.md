# External narrative (living template)

**Last updated:** 2026-11-07  
**Owner (R):** Instinct · **Accountable (A) on claim-touching lines:** Vaibhav  
**Sources of truth:** [STRATEGY-THESIS.md](../STRATEGY-THESIS.md) · [../CHANGELOG.md](../../CHANGELOG.md) · [GTM-GUARDRAILS.md](../GTM-GUARDRAILS.md)

Use this as the outsider-facing story kit. Propose updates after research or a cut; do **not** advance claims past the STRATEGY ladder. Banned claims: [GTM-GUARDRAILS.md](../GTM-GUARDRAILS.md).

---

## One-liner

Know which MCP servers are responding — independent of what the editor still shows.

*(Product thesis voice, internal: “reliability + recovery intelligence layer for MCP integrations” — prefer the plain one-liner for public posts.)*

---

## For / not for

| For | Not for |
|-----|---------|
| Cursor / Open VSX IDE users with MCP servers that go quiet after idle, sleep, or network drops | Teams that only need a proxy/gateway and no IDE-side probe |
| Developers who want status, latency, failure cause, and a guided next step | “Auto-heal everything” / replace the editor MCP client |
| People who care that Watchdog green ≠ editor session green (honest dual-truth) | Public diagnose% dashboards (not earned yet) |

---

## Dual-truth (must stay honest)

Watchdog opens **its own** connection to each approved server. A green Watchdog row means **Watchdog’s probe** succeeded. It does **not** mean the editor’s own MCP session is healthy. Say this in forum/HN copy; never imply host-healthy when connection state is Unknown.

---

## Doctor beat (when the cut ships it)

Failure → short **cause** sentence → **Fix…** guided by cause class → optional **Verified:** after recovery check. Toast stays ≤3 actions. No secret values in frames or posts.

Claim stage today (marketing): **Now+** until the **0.6.0** bake-off announce cut — see STATUS / STRATEGY.

---

## Install path (lead with Open VSX)

1. **Open VSX** — primary for Cursor / Windsurf / VSCodium forks  
2. VS Marketplace — Microsoft VS Code  
3. GitHub Releases `.vsix` — manual / airgapped  

Link: https://open-vsx.org/extension/mcp-watchdog/mcp-watchdog

---

## FAQ (fill from objections)

| Objection | Answer (draft; evidence-labeled) |
|-----------|----------------------------------|
| “Isn’t this just reconnect?” | Independent probe + cause-first Fix + (when shipped) verified recovery — not reconnect alone. Compete vs Bastion on taxonomy + dual-truth, not vibes. |
| “Does green mean Cursor is fine?” | No — dual-truth: Watchdog probe ≠ editor client. |
| “Did you win a bake-off?” | Eng proof exists in-repo; **public** win announce waits for **0.6.0** + Vaibhav. Do not say “win” in Tier 2+ until then. |
| “What % do you diagnose?” | Not public until STRATEGY + field data allow. |

Add rows after announce engagement; keep answers claim-safe.

---

## Per-cut overlay

When drafting an announce, append only this cut’s CHANGELOG user-visible bullets and the claim stage. Do not paste Unreleased wholesale.

| Field | Value |
|-------|--------|
| Version | |
| Claim stage | |
| Bullets | |
| GIF / stills | |
| Channels | |
| Vaibhav packet A? | |

---

## Related

- [LISTING-DRAFT-0.5.7.md](./LISTING-DRAFT-0.5.7.md) — proposed store, README headline, and walkthrough lines for review. Not applied to `package.json` or README.  
- [GTM-ROLE.md](../GTM-ROLE.md) — reach + comprehension  
- [GTM-PUBLISH.md](../GTM-PUBLISH.md) — release map  
- [GTM-COMMS.md](../GTM-COMMS.md) — handoffs  
