#!/usr/bin/env node
/**
 * Phase 6 scaffold — harness CLI (ARCH §9b).
 * v1: parse --host / --cwd, print usage + honesty limits.
 * Full Claude Code / Pi / Codex / OpenCode loaders land after 0.6.0 announce.
 *
 * Never prints env or HTTP header *values* — names only if listed.
 */
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HOSTS = new Set(['claude-code', 'pi', 'codex', 'opencode', 'auto']);

function parseArgs(argv) {
  const out = { host: 'auto', cwd: process.cwd(), help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') out.help = true;
    else if (a === '--host' && argv[i + 1]) {
      out.host = argv[++i];
    } else if (a === '--cwd' && argv[i + 1]) {
      out.cwd = path.resolve(argv[++i]);
    }
  }
  return out;
}

function usage() {
  return `mcp-watchdog — probe MCP configs from terminal harnesses (scaffold)

Usage:
  mcp-watchdog --host claude-code|pi|codex|opencode|auto [--cwd <path>]

Notes:
  - Same Doctor taxonomy as the extension (causeId + Fix).
  - Does not claim harness session health without a documented status signal.
  - Never prints secret env/header values.
  - Full loaders: Claude Code first, then Pi / Codex / OpenCode (post–0.6.0 train).
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    process.exit(0);
  }
  if (!HOSTS.has(args.host)) {
    process.stderr.write(`Unknown --host ${args.host}\n${usage()}`);
    process.exit(2);
  }

  // Scaffold report — loaders not wired yet (STATUS Phase 6).
  const report = {
    ok: false,
    scaffold: true,
    host: args.host,
    cwd: args.cwd,
    message:
      'CLI scaffold only — harness config loaders not enabled yet. Use the VS Code/Cursor extension for probes.',
    claimStage: 'Now+ until 0.6.0 bake-off announce; CLI is distribution expand, not brand pivot',
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(0);
}

const isDirect =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirect) {
  main().catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}

export { parseArgs, usage, HOSTS };
