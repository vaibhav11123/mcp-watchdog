# Research spikes

Curriculum from the vision→execution plan. Study public products/repos; extract algorithms; respect licenses.

**REA pass:** [REA-EVIDENCE.md](./REA-EVIDENCE.md) — cloned repos under [`repos/`](./repos/) + `rea analyze-javascript-application` evidence under [`rea-evidence/`](./rea-evidence/).

| ID | Doc | Deep-dive order |
|---|---|---|
| R1 | [R1-streamable-http.md](./R1-streamable-http.md) | mcp-http-probe → Openstatus / SDKs |
| R2 | [R2-schema-diff.md](./R2-schema-diff.md) | mcp-covenant / mcpwatch → mcp-schema-watch |
| R3 | [R3-bridge-privacy.md](./R3-bridge-privacy.md) | VS Code telemetry → copilot-token-usage → dsh-scan-mcp |
| R5 | [R5-gateway-glossary.md](./R5-gateway-glossary.md) | Obot architecture → policy plane wording |
| R6 | [R6-license-memo.md](./R6-license-memo.md) | MIT + CLA lock; hyperscaler memo |

**Code landed:** R1 fixtures, R2 `diffTools` + goldens, R3 scrub — see `packages/probe-core`. R4/R7: cloud poller + `packages/cloud/migrations/001_init.sql`.
