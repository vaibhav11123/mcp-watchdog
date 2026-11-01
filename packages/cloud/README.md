# Watchdog Cloud (OSS)

**Watchdog Cloud (preview).** Remote health checks, schema change alerts, and configuration policy checks with an audit trail. Policy decisions run outside the MCP tool-call path. With the opt-in IDE bridge enabled, the extension posts names-only incidents (including accepted failures when marked).

## Quick start (T3 target &lt; 30 min)

```bash
# From repo root
cd packages/cloud
cp .env.example .env
# Optional: DATABASE_URL=postgres://...
npm start
```

Open `http://127.0.0.1:8787` — register a monitor URL, run poll-now, POST bridge incidents to `/v1/bridge/incidents`.

Slack: set `SLACK_WEBHOOK_URL` to alert on **breaking** schema diffs only.

See [docs/EXECUTION.md](../../docs/EXECUTION.md) and [docs/PAID-BOUNDARY.md](../../docs/PAID-BOUNDARY.md).
