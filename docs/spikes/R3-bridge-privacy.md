# Spike R3 — Bridge / zero secrets (IDE → cloud)

**Status:** researched (2026-10-30)  
**No perfect MCP-bridge twin.** Study adjacent patterns:  
[VS Code telemetry guide](https://code.visualstudio.com/api/extension-guides/telemetry),  
[github-copilot-token-usage](https://github.com/JasperGilhuis/github-copilot-token-usage),  
[dsh-scan-mcp](https://github.com/chenbin-dev/dsh-scan-mcp)  
**Anti-pattern:** cloud path that ignores opt-out / ships secrets.

## Hard rule (product lock)

Bridge payloads may include **names only** for env/header keys, server ids, tool names, states, timestamps.  
**Never** env values, header values, tokens, cookies, file contents, prompts.

Already in Watchdog DNA:

- `trust.ts` fingerprint: command/args/url — **excludes env and header values**  
- `ServerStatus.failureContext`: documented secret-safe  
- Incidents export: allowlisted fields only

## Patterns to copy (algorithms, not brands)

| Source | Steal |
|---|---|
| VS Code telemetry | Respect `isTelemetryEnabled` + `onDidChangeTelemetryEnabled`; custom setting tags `telemetry` + `usesOnlineServices`; minimize data; no PII |
| Product telemetry (PostHog, 0.5.5+) | **Default on** via `mcpWatchdog.telemetry.enabled` + VS Code gate + usage enablement; allowlisted bare-name Capture fetch; `TelemetryLogger` for Trace echo only; anonymous `installId`; ≠ opt-in `cloudBridge` |
| Copilot token usage | Cloud **opt-in default off**; SecretStorage for keys (never Settings Sync); privacy profiles (Off / Solo / Team anonymized); aggregates not raw secrets; explicit consent when upgrading privacy |
| dsh-scan-mcp | UI and catalog show **env/header NAMES only**; handshake-only probes; never invoke tools for discovery |

## Allowlisted bridge JSON schema (draft)

```jsonc
{
  "schemaVersion": 1,
  "workspaceIdHash": "sha256…",          // hashed, not path string if Team Anonymized
  "extensionVersion": "x.y.z",
  "optIn": true,
  "incident": {
    "id": "ulid",
    "serverName": "string",
    "transport": "stdio|http|sse",
    "urlHost": "example.com",           // host only, no query/fragment
    "commandName": "npx",               // binary name only, not full env
    "stateFrom": "healthy",
    "stateTo": "failed",
    "errorClass": "auth|timeout|protocol|unknown",
    "toolCount": 12,
    "toolDrift": true,
    "headerNames": ["Authorization"],  // names only
    "envNames": ["API_KEY"],            // names only
    "at": "ISO-8601"
  }
}
```

**Rejected keys (negative tests must fail closed):** `env`, `headers`, `authorization`, `token`, `apiKey`, `cookie`, `password`, nested objects under those names, raw `args` that look like secrets (optional scrubber).

## Threat model (short)

| Threat | Mitigation |
|---|---|
| User thinks “link cloud” sends MCP secrets | Default off; consent copy lists fields; dry-run preview |
| Settings Sync leaks bridge token | Store token in **SecretStorage** only |
| Co-extensions / malware read SecretStorage | Minimize token scope; rotatable; short TTL refresh |
| Server receives accidental secret in free-text error | Strip known patterns; never forward `lastError` raw if it may contain URLs with query tokens — classify first |
| Opt-out ignored | Gate every upload on setting + VS Code telemetry flags if we ever share product telemetry |

## T2 direction test

1. Extension posts names-only incident to local cloud API.  
2. Assert dual-truth row stored.  
3. Assert payload contains **zero** env/header **values** (property test + snapshot).  
4. Assert request with `env: { KEY: "secret" }` is **rejected** 400.

## Decisions locked

- Bridge is **opt-in from cloud MVP day one** (execution plan).  
- Privacy profile v1: Off | Solo (private cloud) only; Team modes later.  
- No bridge upload when Watchdog trust gate has not approved the server set.

## Next code action

Add `bridge/schema.ts` + scrub tests in extension test suite before any real HTTP client.
