#!/usr/bin/env node
/**
 * Fails on first spawn (counter file), then runs echo-fixture MCP server.
 * Used to prove fix --yes → Verified resolved without mutating mcp.json.
 */
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const counterPath = process.env.MCP_WATCHDOG_FLAKY_COUNTER;
if (!counterPath) {
  console.error('MCP_WATCHDOG_FLAKY_COUNTER required');
  process.exit(2);
}
let n = 0;
try {
  n = Number(fs.readFileSync(counterPath, 'utf8')) || 0;
} catch {
  n = 0;
}
n += 1;
fs.mkdirSync(path.dirname(counterPath), { recursive: true });
fs.writeFileSync(counterPath, String(n), 'utf8');
if (n === 1) {
  process.exit(1);
}

const repoRoot = path.join(__dirname, '..', '..');
const req = createRequire(path.join(repoRoot, 'package.json'));
const { Server } = req('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = req('@modelcontextprotocol/sdk/server/stdio.js');

async function main() {
  const server = new Server({ name: 'flaky-once', version: '0.0.1' }, { capabilities: {} });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
