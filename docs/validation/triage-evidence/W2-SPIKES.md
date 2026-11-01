# Wave 2 spikes S1–S4 (recorded)

| Spike | Result | Notes |
|-------|--------|-------|
| S1 Guided aws terminal | **pass** | Fix step `terminal.awsLogin` creates terminal + `sendText` profile login (no secret echo) |
| S2 Exa dual-write | **pass** (path) | Credential wizard + confirm dual-write; JSONC refuse; Watchdog-only SecretStorage fallback |
| S3 authProbe | **pass** | Unit: unset → no callTool; set + isError → degraded Auth probe failed |
| S4 Full OAuth client? | **pass → no client** | Guided `openExternal` loginUrl + PRM HTTPS authorize enough for Wave 2; no `OAuthClientProvider` in tree |
