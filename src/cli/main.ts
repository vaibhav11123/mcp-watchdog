import * as path from 'path';
import { emitJson } from './emitJson';
import { applyFixPlan } from './fixApply';
import { buildFixPlan } from './fixPlan';
import { loadClaudeCodeServers, resolveHost } from './loadClaudeCode';
import { mapPool } from './mapPool';
import { probeServerOnce } from './probeOnce';

const HOSTS = new Set(['claude-code', 'pi', 'codex', 'opencode', 'auto']);
const PROBE_CONCURRENCY = 4;

export function parseArgs(argv: string[]): {
  host: string;
  cwd: string;
  help: boolean;
  command: 'doctor' | 'status' | 'fix';
  yes: boolean;
  pretty: boolean;
} {
  const out = {
    host: 'auto',
    cwd: process.cwd(),
    help: false,
    command: 'doctor' as 'doctor' | 'status' | 'fix',
    yes: false,
    pretty: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') out.help = true;
    else if (a === '--host' && argv[i + 1]) out.host = argv[++i]!;
    else if (a === '--cwd' && argv[i + 1]) out.cwd = path.resolve(argv[++i]!);
    else if (a === '--yes' || a === '-y') out.yes = true;
    else if (a === '--full' || a === '--pretty') out.pretty = true;
    else if (a === 'doctor' || a === 'status' || a === 'fix') out.command = a;
  }
  return out;
}

export function usage(): string {
  return `mcp-watchdog — Doctor MCP configs for terminal harnesses

Usage:
  mcp-watchdog [--host claude-code|pi|codex|opencode|auto] [--cwd <path>] [--full]
               [doctor|status|fix] [--yes]

Notes:
  - Same Doctor taxonomy as the VS Code/Cursor extension (causeId + Fix).
  - hostConnection is Unknown unless a documented harness status CLI is used (v1: always Unknown).
  - Never prints secret env/header values.
  - Default JSON is compact (token-efficient); pass --full for pretty indent.
  - fix: plan only by default; --yes applies allowlisted retry.probe + verify (Act+Prove).
  - Kill switch: MCP_WATCHDOG_FIX=0 disables mutate.
  - v1 loader: Claude Code (~/.claude.json + <cwd>/.mcp.json).
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
    emitJson(
      {
        ok: false,
        host: args.host,
        cwd: args.cwd,
        message:
          args.host === 'auto'
            ? 'No Claude Code MCP config found under --cwd / ~/.claude.json. Pass --host explicitly when Pi/Codex/OpenCode loaders ship.'
            : `Host ${args.host} loader not enabled yet (v1 = claude-code).`,
      },
      { pretty: args.pretty, cwd: args.cwd },
    );
    return 1;
  }

  const loaded = loadClaudeCodeServers(args.cwd);
  const names = Object.keys(loaded.servers);
  if (names.length === 0) {
    emitJson(
      {
        ok: false,
        host: 'claude-code',
        cwd: args.cwd,
        sources: loaded.sources,
        message: 'No mcpServers entries found in Claude Code configs.',
      },
      { pretty: args.pretty, cwd: args.cwd },
    );
    return 1;
  }

  const servers = await mapPool(names, PROBE_CONCURRENCY, async (name) => {
    const cfg = loaded.servers[name]!;
    const report = await probeServerOnce(name, cfg);
    const origin = loaded.origins[name];
    return {
      ...report,
      origin: origin ? { path: origin.path, label: origin.label } : undefined,
    };
  });

  const failed = servers.filter((s) => s.state !== 'healthy').length;
  const dualTruth = {
    watchdog: failed === 0 ? 'healthy' : 'failed',
    host: 'unknown' as const,
    note: 'Watchdog probe only — harness session not claimed',
  };

  if (args.command === 'fix') {
    const plan = buildFixPlan(servers);
    if (!args.yes) {
      emitJson(
        {
          ok: failed === 0,
          status: plan.length ? 'confirmation_required' : 'ok',
          command: 'fix',
          host: 'claude-code',
          cwd: args.cwd,
          hostConnection: 'unknown',
          dualTruth,
          plan,
          confirmCommand: plan.length ? `mcp-watchdog fix --yes --cwd ${args.cwd}` : undefined,
          servers,
        },
        { pretty: args.pretty, cwd: args.cwd },
      );
      if (plan.length) return 2;
      return failed > 0 ? 1 : 0;
    }

    const applied = await applyFixPlan({
      cwd: args.cwd,
      servers: loaded.servers,
      beforeReports: servers,
      plan,
      yes: true,
    });
    if (applied.blocked === 'MCP_WATCHDOG_FIX=0 — mutate disabled') {
      emitJson(
        {
          ok: false,
          command: 'fix',
          blocked: applied.blocked,
          dualTruth,
        },
        { pretty: args.pretty, cwd: args.cwd },
      );
      return 1;
    }

    const allResolved =
      applied.results.length > 0 &&
      applied.results.every((r) => r.applied && r.verifiedOutcome === 'resolved');
    const anyResolved = applied.results.some((r) => r.verifiedOutcome === 'resolved');
    const verified = allResolved ? 'resolved' : anyResolved ? 'partial' : 'unresolved';

    emitJson(
      {
        ok: allResolved,
        command: 'fix',
        host: 'claude-code',
        cwd: args.cwd,
        hostConnection: 'unknown',
        dualTruth: {
          watchdog: allResolved ? 'healthy' : dualTruth.watchdog,
          host: 'unknown',
          note: dualTruth.note,
        },
        backupPath: applied.backupPath,
        plan,
        results: applied.results,
        verified,
      },
      { pretty: args.pretty, cwd: args.cwd },
    );
    return allResolved ? 0 : 1;
  }

  emitJson(
    {
      ok: failed === 0,
      scaffold: false,
      command: args.command,
      host: 'claude-code',
      cwd: args.cwd,
      sources: loaded.sources,
      serverCount: servers.length,
      failedCount: failed,
      hostConnection: 'unknown',
      dualTruth,
      servers,
      next: failed > 0 ? 'mcp-watchdog fix --cwd .' : undefined,
    },
    { pretty: args.pretty, cwd: args.cwd },
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
