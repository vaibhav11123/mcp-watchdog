#!/usr/bin/env node
/**
 * Phase 6 CLI entry — loads bundled dist/cli.js (Claude Code doctor/status).
 * Never prints env or HTTP header *values*.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

try {
  require(path.join(__dirname, '..', 'dist', 'cli.js'));
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(
    `mcp-watchdog CLI failed to load dist/cli.js (${msg}). Run: npm run build\n`,
  );
  process.exit(1);
}
