/**
 * Verifies interval-style probing: process exists only during connect/ping window.
 */
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, '..', 'mcp-watchdog-test');

function countMemoryProcs() {
  try {
    const out = execSync("ps aux | grep -c '[s]erver-memory'", { encoding: 'utf8' }).trim();
    return Number.parseInt(out, 10) || 0;
  } catch {
    return 0;
  }
}

async function probeOnce() {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
  });
  const client = new Client({ name: 'verify-interval', version: '0.0.0' }, { capabilities: {} });
  await client.connect(transport);
  await client.ping({ timeout: 15_000 });
  await client.close();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const before = countMemoryProcs();
  console.log(`before probe: ${before} server-memory process(es)`);

  await probeOnce();
  const during = countMemoryProcs();
  console.log(`right after probe start/close: ${during} (may still be winding down)`);

  await sleep(3000);
  const after = countMemoryProcs();
  console.log(`3s after close: ${after} server-memory process(es)`);

  if (after > 0) {
    console.warn('WARN: server-memory still running after close — may be leftover from other tools');
  } else {
    console.log('OK: no persistent server-memory process between probe cycles');
  }

  await probeOnce();
  await sleep(3000);
  const after2 = countMemoryProcs();
  console.log(`second cycle, 3s after close: ${after2} server-memory process(es)`);

  if (after2 === 0) {
    console.log('INTERVAL PROBE VERIFY OK');
  } else {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
