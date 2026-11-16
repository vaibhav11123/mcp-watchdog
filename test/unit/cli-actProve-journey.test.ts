import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyFixPlan } from '../../src/cli/fixApply';
import { buildFixPlan } from '../../src/cli/fixPlan';
import { probeServerOnce } from '../../src/cli/probeOnce';

const flaky = path.join(__dirname, '../../mcp-watchdog-test/fixtures/flaky-once-server.js');
const needsToken = path.join(__dirname, '../../mcp-watchdog-test/fixtures/needs-token-server.js');

describe('Act+Prove journeys (product)', () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
    tmpDirs.length = 0;
  });

  it('F1: flaky → fix --yes → verified resolved', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-f1-'));
    tmpDirs.push(dir);
    const counter = path.join(dir, 'counter');
    const cfg = {
      type: 'stdio' as const,
      command: 'node',
      args: [flaky],
      env: { MCP_WATCHDOG_FLAKY_COUNTER: counter },
    };
    const before = await probeServerOnce('flaky', cfg);
    expect(before.state).not.toBe('healthy');
    const plan = buildFixPlan([before], { flaky: cfg });
    const applied = await applyFixPlan({
      cwd: dir,
      servers: { flaky: cfg },
      beforeReports: [before],
      plan,
      yes: true,
    });
    const verify = applied.results.find((r) => r.stepId === 'retry.probe');
    expect(verify?.verifiedOutcome).toBe('resolved');
    expect(verify?.after.state).toBe('healthy');
  }, 25_000);

  it('F4: empty env in config + shell token → overlay then Verified (no secret in report)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-f4-'));
    tmpDirs.push(dir);
    const secret = 'super-secret-token-not-for-output';
    const cfg = {
      type: 'stdio' as const,
      command: 'node',
      args: [needsToken],
      env: { DEMO_TOKEN: '' },
    };
    const before = await probeServerOnce('tok', cfg);
    expect(before.state).not.toBe('healthy');
    const plan = buildFixPlan([before], { tok: cfg }, { DEMO_TOKEN: secret });
    expect(plan.some((p) => p.id === 'env.overlayFromProcess')).toBe(true);

    const prev = process.env.DEMO_TOKEN;
    process.env.DEMO_TOKEN = secret;
    try {
      const applied = await applyFixPlan({
        cwd: dir,
        servers: { tok: cfg },
        beforeReports: [before],
        plan,
        yes: true,
      });
      const verify = applied.results.find((r) => r.stepId === 'retry.probe');
      expect(verify?.verifiedOutcome).toBe('resolved');
      expect(JSON.stringify(applied)).not.toContain(secret);
    } finally {
      if (prev === undefined) delete process.env.DEMO_TOKEN;
      else process.env.DEMO_TOKEN = prev;
    }
  }, 25_000);
});
