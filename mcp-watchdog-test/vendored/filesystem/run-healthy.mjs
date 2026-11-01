#!/usr/bin/env node
/**
 * Watchdog Tier-3 healthy entry: real @modelcontextprotocol/server-filesystem
 * allowlisted only to ../sandbox (never the whole home dir).
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
const sandbox = path.join(here, 'sandbox');
const child = spawn(process.execPath, [bin, sandbox], {
  stdio: 'inherit',
  env: process.env,
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
