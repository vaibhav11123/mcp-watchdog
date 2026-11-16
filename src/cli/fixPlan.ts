import type { McpServerConfig } from '../config-core';
import type { CliServerReport } from './probeOnce';

import { fillableEnvKeys } from './envOverlay';

export type FixStepId = 'retry.probe' | 'config.ensureNpxYes' | 'env.overlayFromProcess';

export interface FixPlanStep {
  server: string;
  id: FixStepId;
  label: string;
  causeId?: string;
  /** Env key *names* only — never values. */
  envKeys?: string[];
}

function needsNpxYes(cfg?: McpServerConfig): boolean {
  if (!cfg || cfg.type !== 'stdio') return false;
  const base = cfg.command.replace(/\\/g, '/').split('/').pop()?.toLowerCase() ?? '';
  if (base !== 'npx' && base !== 'npx.cmd') return false;
  const args = cfg.args ?? [];
  return !args.some((a) => a === '-y' || a === '--yes' || a === '--yes=true');
}

/**
 * Allowlist plan for failed servers:
 * 1. env.overlayFromProcess (in-memory; no mcp.json secret write)
 * 2. config.ensureNpxYes when npx lacks -y
 * 3. retry.probe
 */
export function buildFixPlan(
  servers: CliServerReport[],
  configs: Record<string, McpServerConfig> = {},
  env: NodeJS.ProcessEnv = process.env,
): FixPlanStep[] {
  const plan: FixPlanStep[] = [];
  for (const s of servers) {
    if (s.state === 'healthy' || s.state === 'connecting') continue;
    const cfg = configs[s.name];
    const fillKeys = cfg ? fillableEnvKeys(cfg, env) : [];
    if (fillKeys.length) {
      plan.push({
        server: s.name,
        id: 'env.overlayFromProcess',
        label: `Use shell env (${fillKeys.join(', ')}) — not written to mcp.json`,
        causeId: s.causeId,
        envKeys: fillKeys,
      });
    }
    if (needsNpxYes(cfg)) {
      plan.push({
        server: s.name,
        id: 'config.ensureNpxYes',
        label: 'Add npx -y (non-interactive)',
        causeId: s.causeId,
      });
    }
    plan.push({
      server: s.name,
      id: 'retry.probe',
      label: 'Retry probe',
      causeId: s.causeId,
    });
  }
  return plan;
}
