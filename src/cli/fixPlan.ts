import type { McpServerConfig } from '../config-core';
import type { CliServerReport } from './probeOnce';

export type FixStepId = 'retry.probe' | 'config.ensureNpxYes';

export interface FixPlanStep {
  server: string;
  id: FixStepId;
  label: string;
  causeId?: string;
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
 * 1. config.ensureNpxYes when npx lacks -y
 * 2. retry.probe
 */
export function buildFixPlan(
  servers: CliServerReport[],
  configs: Record<string, McpServerConfig> = {},
): FixPlanStep[] {
  const plan: FixPlanStep[] = [];
  for (const s of servers) {
    if (s.state === 'healthy' || s.state === 'connecting') continue;
    const cfg = configs[s.name];
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
