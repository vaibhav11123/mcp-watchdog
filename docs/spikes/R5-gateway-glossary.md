# Spike R5 — Gateway wording (policy plane ≠ proxy)

**Status:** researched (2026-10-30)  
**Proxy class (study, do not build day one):** Obot, Docker MCP Gateway, Bifrost, ContextForge, MCPX, Microsoft MCP Gateway  
**Our MVP:** allowlist / approval audit / trust gate — call it **policy / trust plane**

## Glossary (user-facing lock)

| Term | Meaning | We ship in MVP? |
|---|---|---|
| **Policy / trust plane** | Rules about *which* MCP servers/commands/URLs engineers may use; approval + audit log; optionally force Watchdog | **Yes** |
| **Proxy gateway** | In-path reverse proxy: client → gateway → upstream MCP; authz, token exchange, filters, hosting | **No** (Phase 5 research) |
| **vMCP** (Obot) | Virtual endpoint combining tools from multiple servers behind one URL | Not MVP |
| **MCP Hosting** | Platform runs MCP workloads (Docker/K8s) for you | Not MVP |
| **Author monitor** | Scheduled handshake + schema drift + Slack | Cloud MVP (separate module) |
| **Bridge** | Opt-in IDE incidents ↔ cloud server ids | Cloud MVP |

## What Obot actually is ([architecture](https://docs.obot.ai/concepts/architecture/))

From Obot docs:

- **MCP Gateway** — proxy that authenticates/authorizes, audits, runs filters, **forwards** allowed traffic  
- **MCP Hosting** — separate containers/K8s for hosted servers  
- **LLM Gateway** — separate proxy for model traffic  
- **Registry / catalog** — curated servers and skills  
- Dual auth: client→Obot tokens vs Obot→upstream credentials retained by Obot  

[Request flows](https://docs.obot.ai/architecture/request-flows/): client → Obot gateway → hosted/remote MCP is an enforcement point. Clients that talk **directly** to a server **bypass** the gateway.

**Implication:** users who hear “gateway” expect Obot-like proxy + hosting. If we say “gateway” for allowlist-only, we create false expectations and lose demos against Obot.

## Positioning language (copy)

**Prefer**

- “Team **policy plane** for MCP trust”  
- “Allowlist + approval audit (works with your existing Cursor/VS Code MCP config)”  
- “Not a reverse proxy — we don’t sit in the request path (yet)”

**Avoid in MVP marketing**

- “MCP Gateway” without qualifier  
- “Replace Obot / Runlayer”  
- Claims of request filtering, token exchange, or hosted MCP runtime

## When we build proxy (criteria)

Only after **documented demand**: design partners need in-path authz, or policy alone cannot enforce (users bypass IDE). Then study Docker MCP Gateway isolation + Obot filter model as a research track — not a seed MVP scope.

## Decisions locked

- Phase 3 name in UI/docs: **policy / trust plane**  
- DNA: extend `trust.ts` allowlist + approval memento → org-level allowlist + audit export  
- Product-decision.md “gateway-lite” ≡ this glossary’s policy plane (rename in EXECUTION.md)

## Next doc action

When writing `docs/EXECUTION.md`, use “policy plane” everywhere Phase 3 appears; reserve “proxy gateway” for Phase 5.
