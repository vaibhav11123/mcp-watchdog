import * as fs from 'fs';
import * as path from 'path';
import type { McpServerConfig } from '../config-core';
import { parseConfigFile } from '../config-core';
import { ensureNpxYes } from '../mcpJsonEdit';
import { observationFromStatus } from '../observationFromStatus';
import { verifyAfterFix, type VerifiedOutcome } from '../verifyRecovery';
import type { FixPlanStep } from './fixPlan';
import { probeServerOnce, type CliServerReport } from './probeOnce';

export interface FixApplyResult {
  server: string;
  stepId: string;
  applied: boolean;
  verifiedOutcome: VerifiedOutcome | null;
  after: CliServerReport;
  backupPath?: string;
  detail?: string;
}

function backupMcpJson(cwd: string): string | undefined {
  const src = path.join(cwd, '.mcp.json');
  if (!fs.existsSync(src)) return undefined;
  const dir = path.join(cwd, '.mcp-watchdog', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(dir, `${stamp}-mcp.json`);
  fs.copyFileSync(src, dest);
  return dest;
}

function reloadServerConfig(
  cwd: string,
  name: string,
  fallback: McpServerConfig | undefined,
): McpServerConfig | undefined {
  const file = path.join(cwd, '.mcp.json');
  if (!fs.existsSync(file)) return fallback;
  const raw = fs.readFileSync(file, 'utf8');
  const parsed = parseConfigFile(raw, cwd);
  if (!parsed.ok) return fallback;
  return parsed.servers[name] ?? fallback;
}

/**
 * Apply allowlisted steps. Kill switch: MCP_WATCHDOG_FIX=0
 */
export async function applyFixPlan(args: {
  cwd: string;
  servers: Record<string, McpServerConfig>;
  beforeReports: CliServerReport[];
  plan: FixPlanStep[];
  yes: boolean;
}): Promise<{ results: FixApplyResult[]; backupPath?: string; blocked?: string }> {
  if (process.env.MCP_WATCHDOG_FIX === '0') {
    return { results: [], blocked: 'MCP_WATCHDOG_FIX=0 — mutate disabled' };
  }
  if (!args.yes) {
    return { results: [], blocked: 'confirmation_required' };
  }

  const backupPath = backupMcpJson(args.cwd);
  const beforeByName = new Map(args.beforeReports.map((r) => [r.name, r]));
  const liveConfigs: Record<string, McpServerConfig> = { ...args.servers };
  const results: FixApplyResult[] = [];

  for (const step of args.plan) {
    const beforeReport = beforeByName.get(step.server);
    const beforeObs = observationFromStatus({
      name: step.server,
      state: beforeReport?.state ?? 'failed',
      retryCount: 0,
      lastError: beforeReport?.lastError,
    });

    if (step.id === 'config.ensureNpxYes') {
      const mcpPath = path.join(args.cwd, '.mcp.json');
      if (!fs.existsSync(mcpPath)) {
        results.push({
          server: step.server,
          stepId: step.id,
          applied: false,
          verifiedOutcome: null,
          after: beforeReport ?? {
            name: step.server,
            state: 'failed',
            hostConnection: 'unknown',
          },
          detail: 'no .mcp.json',
          backupPath,
        });
        break;
      }
      const raw = fs.readFileSync(mcpPath, 'utf8');
      const edited = ensureNpxYes(raw, step.server);
      if (!edited.ok) {
        results.push({
          server: step.server,
          stepId: step.id,
          applied: false,
          verifiedOutcome: null,
          after: beforeReport ?? {
            name: step.server,
            state: 'failed',
            hostConnection: 'unknown',
          },
          detail: edited.reason,
          backupPath,
        });
        break;
      }
      fs.writeFileSync(mcpPath, edited.raw, 'utf8');
      const cfg = reloadServerConfig(args.cwd, step.server, liveConfigs[step.server]);
      if (cfg) liveConfigs[step.server] = cfg;
      results.push({
        server: step.server,
        stepId: step.id,
        applied: true,
        verifiedOutcome: null,
        after: beforeReport ?? {
          name: step.server,
          state: 'failed',
          hostConnection: 'unknown',
        },
        detail: 'inserted npx -y',
        backupPath,
      });
      continue;
    }

    if (step.id !== 'retry.probe') {
      results.push({
        server: step.server,
        stepId: step.id,
        applied: false,
        verifiedOutcome: null,
        after: beforeReport ?? {
          name: step.server,
          state: 'failed',
          hostConnection: 'unknown',
        },
        backupPath,
      });
      break;
    }

    const cfg = liveConfigs[step.server];
    if (!cfg) continue;
    const after = await probeServerOnce(step.server, cfg);
    const afterObs = observationFromStatus({
      name: after.name,
      state: after.state,
      retryCount: 0,
      lastError: after.lastError,
    });
    const verifiedOutcome = verifyAfterFix({ before: beforeObs, after: afterObs });
    results.push({
      server: step.server,
      stepId: step.id,
      applied: true,
      verifiedOutcome,
      after,
      backupPath,
    });
    beforeByName.set(step.server, after);
    if (verifiedOutcome !== 'resolved') {
      break;
    }
  }

  return { results, backupPath };
}
