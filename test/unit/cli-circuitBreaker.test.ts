import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { clearCircuit, isCircuitOpen, recordCircuitFailure } from '../../src/cli/circuitBreaker';

describe('CLI circuit breaker', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it('opens after 2 failures of same cause+step in 10 min', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-cb-'));
    dirs.push(cwd);
    const t0 = 2_000_000;
    expect(isCircuitOpen(cwd, 'spawn.closed', 'retry.probe', t0)).toBe(false);
    const first = recordCircuitFailure(cwd, 'spawn.closed', 'retry.probe', t0);
    expect(first.open).toBe(false);
    const second = recordCircuitFailure(cwd, 'spawn.closed', 'retry.probe', t0 + 1);
    expect(second.open).toBe(true);
    expect(isCircuitOpen(cwd, 'spawn.closed', 'retry.probe', t0 + 2)).toBe(true);
  });

  it('clears on success so a later apply can run', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-cb2-'));
    dirs.push(cwd);
    const t0 = 3_000_000;
    recordCircuitFailure(cwd, 'generic', 'config.ensureNpxYes', t0);
    recordCircuitFailure(cwd, 'generic', 'config.ensureNpxYes', t0 + 1);
    expect(isCircuitOpen(cwd, 'generic', 'config.ensureNpxYes', t0 + 2)).toBe(true);
    clearCircuit(cwd, 'generic', 'config.ensureNpxYes', t0 + 3);
    expect(isCircuitOpen(cwd, 'generic', 'config.ensureNpxYes', t0 + 4)).toBe(false);
  });
});
