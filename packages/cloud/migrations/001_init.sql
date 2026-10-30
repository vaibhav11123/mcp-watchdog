-- Watchdog Cloud ERD (adapted from mcp-schema-watch ideas; re-derived)
CREATE TABLE IF NOT EXISTS watched_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  poll_interval_sec INT NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schema_snapshots (
  id BIGSERIAL PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES watched_servers(id),
  schema_hash TEXT NOT NULL,
  tools_json TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schema_snapshots_server_captured
  ON schema_snapshots (server_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS schema_diffs (
  id BIGSERIAL PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES watched_servers(id),
  severity TEXT NOT NULL,
  diff_json TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS poll_failures (
  id BIGSERIAL PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES watched_servers(id),
  error_class TEXT NOT NULL,
  detail TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bridge_incidents (
  id TEXT PRIMARY KEY,
  workspace_id_hash TEXT NOT NULL,
  server_name TEXT NOT NULL,
  ide_state TEXT NOT NULL,
  cloud_probe_state TEXT,
  payload_json TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS policy_rules (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT 'default',
  rule_json TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS policy_audit (
  id BIGSERIAL PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT 'default',
  action TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
