import * as path from 'path';
import { loadClaudeCodeServers, resolveHost } from './loadClaudeCode';
import { probeServerOnce } from './probeOnce';

const HOSTS = new Set(['claude-code', 'pi', 'codex', 'opencode', 'auto']);

export function parseArgs(argv: string[]): {
  host: string;
  cwd: string;
  help: boolean;
  command: 'doctor' | 'status';
} {
  const out = {
    host: 'auto',
    cwd: process.cwd(),
    help: false,
    command: 'doctor' as 'doctor' | 'status',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') out.help = true;
    else if (a === '--host' && argv[i + 1]) out.host = argv[++i]!;
    else if (a === '--cwd' && argv[i + 1]) out.cwd = path.resolve(argv[++i]!);
    else if (a === 'doctor' || a === 'status') out.command = a;
  }
  return out;
}

export function usage(): string {
  return `mcp-watchdog — Doctor MCP configs for terminal harnesses

Usage:
  mcp-watchdog [--host claude-code|pi|codex|opencode|auto] [--cwd <path>] [doctor|status]

Notes:
  - Same Doctor taxonomy as the VS Code/Cursor extension (causeId + Fix).
  - hostConnection is Unknown unless a documented harness status CLI is used (v1: always Unknown).
  - Never prints secret env/header values.
  - v1 loader: Claude Code (~/.claude.json + <cwd>/.mcp.json). Pi/Codex/OpenCode: coming next.
`;
}

export async function runCli(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (!HOSTS.has(args.host)) {
    process.stderr.write(`Unknown --host ${args.host}\n${usage()}`);
    return 2;
  }

  const resolved = resolveHost(args.host, args.cwd);
  if (resolved === 'unsupported') {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: false,
          host: args.host,
          cwd: args.cwd,
          message:
            args.host === 'auto'
              ? 'No Claude Code MCP config found under --cwd / ~/.claude.json. Pass --host explicitly when Pi/Codex/OpenCode loaders ship.'
              : `Host ${args.host} loader not enabled yet (v1 = claude-code).`,
        },
        null,
        2,
      )}\n`,
    );
    return 1;
  }

  const loaded = loadClaudeCodeServers(args.cwd);
  const names = Object.keys(loaded.servers);
  if (names.length === 0) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: false,
          host: 'claude-code',
          cwd: args.cwd,
          sources: loaded.sources,
          message: 'No mcpServers entries found in Claude Code configs.',
        },
        null,
        2,
      )}\n`,
    );
    return 1;
  }

  const servers = [];
  for (const name of names) {
    const cfg = loaded.servers[name]!;
    const report = await probeServerOnce(name, cfg);
    const origin = loaded.origins[name];
    servers.push({
      ...report,
      origin: origin ? { path: origin.path, label: origin.label } : undefined,
    });
  }

  const failed = servers.filter((s) => s.state !== 'healthy').length;
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        scaffold: false,
        command: args.command,
        host: 'claude-code',
        cwd: args.cwd,
        sources: loaded.sources,
        serverCount: servers.length,
        failedCount: failed,
        hostConnection: 'unknown',
        servers,
      },
      null,
      2,
    )}\n`,
  );
  return failed > 0 ? 1 : 0;
}

async function main(): Promise<void> {
  const code = await runCli(process.argv.slice(2));
  process.exit(code);
}

/** Avoid running when Vitest (or other importers) load parseArgs/runCli. */
const invokedAsCli = (() => {
  const entry = process.argv[1]?.replace(/\\/g, '/') ?? '';
  return /(?:cli\/main\.(?:ts|js)|[/]cli\.js|mcp-watchdog(?:\.mjs)?)$/.test(entry);
})();

if (invokedAsCli) {
  void main().catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
