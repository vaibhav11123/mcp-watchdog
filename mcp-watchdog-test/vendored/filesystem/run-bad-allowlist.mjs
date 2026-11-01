#!/usr/bin/env node
/**
 * Intentional fail DUT: pass a non-existent allowlist path so the real
 * filesystem MCP exits during startup (spawn/failed for Watchdog).
 * REA-informed: dist/index.js exits 1 when args are not accessible directories.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(
  here,
  'pkg',
  'node_modules',
  '@modelcontextprotocol',
  'server-filesystem',
  'dist',
  'index.js',
);
const missing = path.join(here, 'sandbox', '__does_not_exist_watchdog__');
const child = spawn(process.execPath, [bin, missing], {
  stdio: 'inherit',
  env: process.env,
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
