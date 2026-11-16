import type { CliServerReport } from './probeOnce';

export interface FixPlanStep {
  server: string;
  id: 'retry.probe';
  label: string;
  causeId?: string;
}

/** v1 allowlist: retry.probe only for failed/degraded/disconnected servers. */
export function buildFixPlan(servers: CliServerReport[]): FixPlanStep[] {
  const plan: FixPlanStep[] = [];
  for (const s of servers) {
    if (s.state === 'healthy' || s.state === 'connecting') continue;
    plan.push({
      server: s.name,
      id: 'retry.probe',
      label: 'Retry probe',
      causeId: s.causeId,
    });
  }
  return plan;
}
