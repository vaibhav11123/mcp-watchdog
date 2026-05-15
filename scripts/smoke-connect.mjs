/**
 * Headless smoke: same Client + StdioClientTransport + ping path as the extension.
 * Does not load VS Code — validates npx + anthropic server + @modelcontextprotocol/sdk.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-memory'],
});

const client = new Client({ name: 'mcp-watchdog-smoke', version: '0.0.0' }, { capabilities: {} });

try {
  await client.connect(transport);
  await client.ping({ timeout: 10_000 });
  console.log('SMOKE OK: connect + ping succeeded');
} finally {
  await client.close().catch(() => {});
}
