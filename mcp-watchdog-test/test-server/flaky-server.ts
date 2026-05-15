/**
 * Voluntary MCP stdio server that exits after DEATH_AFTER_MS (default 10s).
 * Add to `.vscode/mcp.json`:
 *
 * "flaky": {
 *   "type": "stdio",
 *   "command": "npx",
 *   "args": ["-y", "tsx", "${workspaceFolder}/test-server/flaky-server.ts"],
 *   "cwd": "${workspaceFolder}",
 *   "env": { "DEATH_AFTER_MS": "8000" }
 * }
 *
 * With `mcpWatchdog.pingIntervalMs` at 5000, expect reconnect within ~15s.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const DEATH_TIMEOUT_MS = parseInt(process.env.DEATH_AFTER_MS ?? '10000', 10);

const server = new McpServer({ name: 'flaky-server', version: '1.0.0' });

server.registerTool(
  'echo',
  {
    description: 'Echo a message',
    inputSchema: { message: z.string() },
  },
  async ({ message }) => ({
    content: [{ type: 'text' as const, text: `Echo: ${message}` }],
  }),
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`[flaky-server] Listening. Exit in ${DEATH_TIMEOUT_MS}ms`);
  setTimeout(() => {
    console.error('[flaky-server] Simulating idle death — exiting');
    process.exit(0);
  }, DEATH_TIMEOUT_MS);
}

main().catch((error) => {
  console.error('flaky-server error:', error);
  process.exit(1);
});
