#!/usr/bin/env node
const path = require('path');
const { createRequire } = require('module');

const repoRoot = path.join(__dirname, '..', '..');
const req = createRequire(path.join(repoRoot, 'package.json'));
const { Server } = req('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = req('@modelcontextprotocol/sdk/server/stdio.js');

async function main() {
  const server = new Server({ name: 'echo-fixture', version: '0.0.1' }, { capabilities: {} });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
