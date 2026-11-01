#!/usr/bin/env node
/**
 * Tier-3 smoke: vendored filesystem MCP healthy start + bad-allowlist exit.
 * No network after pkg install; no AWS/Exa secrets.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const healthy = path.join(root, 'mcp-watchdog-test/vendored/filesystem/run-healthy.mjs');
const bad = path.join(root, 'mcp-watchdog-test/vendored/filesystem/run-bad-allowlist.mjs');

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let stderr = '';
    p.stderr.on('data', (d) => {
      stderr += d.toString('utf8');
    });
    const t = setTimeout(() => {
      p.kill('SIGTERM');
      resolve({ code: null, timedOut: true, stderr });
    }, opts.timeoutMs ?? 8000);
    p.on('exit', (code) => {
      clearTimeout(t);
      resolve({ code, timedOut: false, stderr });
    });
  });
}

async function probeHealthy() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [healthy],
  });
  const client = new Client({ name: 'tier3-fs-smoke', version: '0.0.0' }, { capabilities: {} });
  await client.connect(transport);
  const tools = await client.listTools();
  await client.close();
  if (!tools.tools?.length) throw new Error('healthy connect but no tools');
  console.log(`OK healthy: ${tools.tools.length} tools`);
}

async function probeBad() {
  const r = await run(process.execPath, [bad], { timeoutMs: 5000 });
  if (r.timedOut) throw new Error('bad-allowlist did not exit');
  if (r.code === 0) throw new Error('bad-allowlist exited 0 (expected failure)');
  console.log(`OK bad-allowlist: exit ${r.code}`);
}

await probeHealthy();
await probeBad();
console.log('tier3-filesystem-smoke PASS');
