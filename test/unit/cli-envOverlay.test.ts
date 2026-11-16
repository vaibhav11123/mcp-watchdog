import { describe, expect, it } from 'vitest';
import { applyProcessEnvOverlay, fillableEnvKeys } from '../../src/cli/envOverlay';
import { buildFixPlan } from '../../src/cli/fixPlan';
import type { CliServerReport } from '../../src/cli/probeOnce';

describe('envOverlay', () => {
  it('lists empty env keys present in process.env', () => {
    const cfg = {
      type: 'stdio' as const,
      command: 'node',
      args: ['x.js'],
      env: { DEMO_TOKEN: '', OTHER: 'keep' },
    };
    expect(fillableEnvKeys(cfg, { DEMO_TOKEN: 'secret', OTHER: 'x' })).toEqual(['DEMO_TOKEN']);
  });

  it('applies overlay without mutating missing keys', () => {
    const cfg = {
      type: 'stdio' as const,
      command: 'node',
      args: ['x.js'],
      env: { DEMO_TOKEN: '' },
    };
    const { config, filledKeys } = applyProcessEnvOverlay(cfg, { DEMO_TOKEN: 'secret-value' });
    expect(filledKeys).toEqual(['DEMO_TOKEN']);
    expect(config.type === 'stdio' && config.env?.DEMO_TOKEN).toBe('secret-value');
  });
});

describe('buildFixPlan env.overlayFromProcess', () => {
  it('plans overlay before retry when shell has the key', () => {
    const servers: CliServerReport[] = [
      {
        name: 'tok',
        state: 'degraded',
        causeId: 'spawn.closed',
        hostConnection: 'unknown',
      },
    ];
    const plan = buildFixPlan(
      servers,
      {
        tok: {
          type: 'stdio',
          command: 'node',
          args: ['x.js'],
          env: { DEMO_TOKEN: '' },
        },
      },
      { DEMO_TOKEN: 'from-shell' },
    );
    expect(plan.map((p) => p.id)).toEqual(['env.overlayFromProcess', 'retry.probe']);
    expect(plan[0]?.envKeys).toEqual(['DEMO_TOKEN']);
  });
});
