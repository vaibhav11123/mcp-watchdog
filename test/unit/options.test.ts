import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce, jittered, resolveServerOptions, type MonitorOptions } from '../../src/options';

const globals: MonitorOptions = {
  probeMode: 'interval',
  pingIntervalMs: 30_000,
  pingTimeoutMs: 5000,
  maxRetries: 5,
  initialBackoffMs: 1000,
  backoffMultiplier: 1.5,
  maxBackoffMs: 30_000,
  jitterRand: () => 0.5,
};

describe('resolveServerOptions', () => {
  it('returns globals when no per-server override', () => {
    const r = resolveServerOptions(globals, {}, 'memory');
    expect(r.enabled).toBe(true);
    expect(r.options).toEqual(globals);
  });

  it('applies per-server probeMode and pingIntervalMs', () => {
    const r = resolveServerOptions(
      globals,
      { memory: { probeMode: 'persistent', pingIntervalMs: 60_000 } },
      'memory',
    );
    expect(r.options.probeMode).toBe('persistent');
    expect(r.options.pingIntervalMs).toBe(60_000);
    expect(r.options.maxRetries).toBe(5);
  });

  it('marks server disabled when enabled:false', () => {
    const r = resolveServerOptions(globals, { memory: { enabled: false } }, 'memory');
    expect(r.enabled).toBe(false);
  });
});

describe('jittered', () => {
  it('stays within 0.9x–1.1x for fixed rand', () => {
    expect(jittered(10_000, () => 0)).toBe(9000);
    expect(jittered(10_000, () => 0.5)).toBe(10_000);
    expect(jittered(10_000, () => 1)).toBe(11_000);
  });
});

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces rapid calls', () => {
    const fn = vi.fn();
    const d = debounce(fn, 500);
    d();
    d();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
