import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyFixPlan } from '../../src/cli/fixApply';
import { MUTATE_MAX, canMutate, recordMutate } from '../../src/cli/rateLimit';

describe('CLI rate limit', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it('allows 3 mutates then blocks the 4th in the window', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-rl-'));
    dirs.push(cwd);
    const t0 = 1_000_000;
    expect(canMutate(cwd, t0).ok).toBe(true);
    recordMutate(cwd, t0);
    recordMutate(cwd, t0 + 1);
    recordMutate(cwd, t0 + 2);
    const blocked = canMutate(cwd, t0 + 3);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.reason).toBe('rate_limited');
      expect(blocked.count).toBe(MUTATE_MAX);
    }
  });

  it('exposes max of 3 mutates (kill switch still checked first in applyFixPlan)', () => {
    expect(MUTATE_MAX).toBe(3);
  });

  it('prunes timestamps outside the 5 minute window', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-rl2-'));
    dirs.push(cwd);
    const t0 = 5_000_000;
    recordMutate(cwd, t0);
    recordMutate(cwd, t0 + 1);
    recordMutate(cwd, t0 + 2);
    const later = t0 + 5 * 60 * 1000 + 1;
    expect(canMutate(cwd, later).ok).toBe(true);
  });

  it('applyFixPlan blocks when window is already full', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-rl3-'));
    dirs.push(cwd);
    const now = Date.now();
    recordMutate(cwd, now);
    recordMutate(cwd, now + 1);
    recordMutate(cwd, now + 2);
    const applied = await applyFixPlan({
      cwd,
      servers: {},
      beforeReports: [],
      plan: [
        {
          server: 'x',
          id: 'retry.probe',
          label: 'Retry probe',
          causeId: 'generic',
        },
      ],
      yes: true,
    });
    expect(applied.blocked).toMatch(/rate_limited/);
    expect(applied.results).toEqual([]);
  });
});
