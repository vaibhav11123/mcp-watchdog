#!/usr/bin/env node
/** Fails without DEMO_TOKEN; runs echo MCP when set. Secret value never printed. */
if (!process.env.DEMO_TOKEN) {
  process.stderr.write('DEMO_TOKEN missing\n');
  process.exit(1);
}

const path = require('path');
const { createRequire } = require('module');
const repoRoot = path.join(__dirname, '..', '..');
const req = createRequire(path.join(repoRoot, 'package.json'));
const { Server } = req('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = req('@modelcontextprotocol/sdk/server/stdio.js');

async function main() {
  const server = new Server({ name: 'needs-token', version: '0.0.1' }, { capabilities: {} });
  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
