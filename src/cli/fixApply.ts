import * as fs from 'fs';
import * as path from 'path';
import type { McpServerConfig } from '../config-core';
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

/**
 * Apply allowlisted steps. v1: retry.probe only (re-probe + verify).
 * Kill switch: MCP_WATCHDOG_FIX=0
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
  const results: FixApplyResult[] = [];

  for (const step of args.plan) {
    if (step.id !== 'retry.probe') {
      results.push({
        server: step.server,
        stepId: step.id,
        applied: false,
        verifiedOutcome: null,
        after: beforeByName.get(step.server) ?? {
          name: step.server,
          state: 'failed',
          hostConnection: 'unknown',
        },
      });
      continue;
    }
    const cfg = args.servers[step.server];
    if (!cfg) continue;
    const beforeReport = beforeByName.get(step.server);
    const beforeObs = observationFromStatus({
      name: step.server,
      state: beforeReport?.state ?? 'failed',
      retryCount: 0,
      lastError: beforeReport?.lastError,
    });
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
    // Circuit: stop on first unresolved after apply for v1
    if (verifiedOutcome !== 'resolved') {
      break;
    }
  }

  return { results, backupPath };
}
