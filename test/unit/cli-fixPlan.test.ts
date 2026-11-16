import { describe, expect, it } from 'vitest';
import { buildFixPlan } from '../../src/cli/fixPlan';
import type { CliServerReport } from '../../src/cli/probeOnce';

describe('buildFixPlan', () => {
  it('plans retry.probe only for non-healthy servers', () => {
    const servers: CliServerReport[] = [
      { name: 'ok', state: 'healthy', hostConnection: 'unknown' },
      {
        name: 'bad',
        state: 'degraded',
        causeId: 'spawn.closed',
        hostConnection: 'unknown',
      },
    ];
    expect(buildFixPlan(servers)).toEqual([
      {
        server: 'bad',
        id: 'retry.probe',
        label: 'Retry probe',
        causeId: 'spawn.closed',
      },
    ]);
  });

  it('adds ensureNpxYes before retry when npx lacks -y', () => {
    const servers: CliServerReport[] = [
      {
        name: 'footgun',
        state: 'degraded',
        causeId: 'generic',
        hostConnection: 'unknown',
      },
    ];
    const plan = buildFixPlan(servers, {
      footgun: {
        type: 'stdio',
        command: 'npx',
        args: ['@modelcontextprotocol/server-everything'],
      },
    });
    expect(plan.map((p) => p.id)).toEqual(['config.ensureNpxYes', 'retry.probe']);
  });
});
