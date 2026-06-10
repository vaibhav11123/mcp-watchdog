import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ServerMonitor,
  type MonitorClient,
  type MonitorClientFactory,
  type MonitorClock,
} from '../../src/monitor';
import type { McpServerConfig } from '../../src/config-core';

const stdioConfig: McpServerConfig = { type: 'stdio', command: 'echo', args: ['ok'] };

const defaultOptions = {
  probeMode: 'persistent' as const,
  pingIntervalMs: 30_000,
  pingTimeoutMs: 5000,
  maxRetries: 5,
  initialBackoffMs: 1000,
  backoffMultiplier: 1.5,
  maxBackoffMs: 30_000,
  jitterRand: () => 0.5,
};

function makeMockClient(behavior: {
  connect?: () => Promise<void>;
  ping?: () => Promise<void>;
  close?: () => Promise<void>;
}): MonitorClient {
  return {
    connect: behavior.connect ?? (async () => {}),
    ping: behavior.ping ?? (async () => {}),
    close: behavior.close ?? (async () => {}),
  };
}

function makeFactory(client: MonitorClient): MonitorClientFactory {
  return () => ({ client, transport: {} });
}

function makeFakeClock(): MonitorClock & {
  handlers: Array<{ fn: () => void; ms: number; id: number }>;
} {
  const handlers: Array<{ fn: () => void; ms: number; id: number }> = [];
  let nextId = 1;
  return {
    handlers,
    setTimeout: (fn, ms) => {
      const id = nextId++;
      handlers.push({ fn: fn as () => void, ms, id });
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout: (id) => {
      const idx = handlers.findIndex((h) => h.id === id);
      if (idx >= 0) handlers.splice(idx, 1);
    },
    now: () => Date.now(),
  };
}

function makeMonitor(
  factory: MonitorClientFactory,
  clock: MonitorClock,
  onStatus = vi.fn(),
  log = vi.fn(),
  options = defaultOptions,
): ServerMonitor {
  return new ServerMonitor('test', stdioConfig, options, onStatus, log, clock, factory);
}

/** Handlers call `void doPing()` / `void connect()` — flush microtasks after firing. */
async function runHandler(handler: { fn: () => void }): Promise<void> {
  handler.fn();
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

describe('ServerMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('connects successfully → healthy, schedules ping', async () => {
    const onStatus = vi.fn();
    const clock = makeFakeClock();
    const monitor = makeMonitor(makeFactory(makeMockClient({})), clock, onStatus);

    await monitor.start();

    expect(onStatus.mock.calls.at(-1)?.[0].state).toBe('healthy');
    expect(clock.handlers.some((h) => h.ms === 30_000)).toBe(true);
  });

  it('ping success keeps healthy and records lastPingMs', async () => {
    const onStatus = vi.fn();
    const clock = makeFakeClock();
    const monitor = makeMonitor(
      makeFactory(makeMockClient({ ping: async () => {} })),
      clock,
      onStatus,
    );

    await monitor.start();
    const pingHandler = clock.handlers.find((h) => h.ms === 30_000);
    expect(pingHandler).toBeDefined();
    await runHandler(pingHandler!);

    const withPing = onStatus.mock.calls.find((c) => c[0].lastPingMs !== undefined)?.[0];
    expect(withPing?.state).toBe('healthy');
  });

  it('ping failure → degraded, closes client, schedules retry at 1000ms', async () => {
    const onStatus = vi.fn();
    const close = vi.fn(async () => {});
    const client = makeMockClient({
      ping: async () => {
        throw new Error('timeout');
      },
      close,
    });
    const clock = makeFakeClock();
    const monitor = makeMonitor(makeFactory(client), clock, onStatus);

    await monitor.start();
    const pingHandler = clock.handlers.find((h) => h.ms === 30_000);
    await runHandler(pingHandler!);

    expect(close).toHaveBeenCalled();
    expect(onStatus.mock.calls.some((c) => c[0].state === 'degraded')).toBe(true);
    expect(clock.handlers.some((h) => h.ms === 1000)).toBe(true);
  });

  it('getStatus returns a shallow copy of current status', async () => {
    const clock = makeFakeClock();
    const monitor = makeMonitor(makeFactory(makeMockClient({})), clock);

    await monitor.start();
    const a = monitor.getStatus();
    const b = monitor.getStatus();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a.state).toBe('healthy');
  });

  it('connect failure backoff uses 1000, 1500, 2250 ms delays', async () => {
    const clock = makeFakeClock();
    const client = makeMockClient({
      connect: async () => {
        throw new Error('down');
      },
    });
    const monitor = makeMonitor(makeFactory(client), clock);

    await monitor.start();
    expect(clock.handlers.find((h) => h.ms === 1000)).toBeDefined();
    await runHandler(clock.handlers.find((h) => h.ms === 1000)!);
    expect(clock.handlers.find((h) => h.ms === 1500)).toBeDefined();
    await runHandler(clock.handlers.find((h) => h.ms === 1500)!);
    expect(clock.handlers.find((h) => h.ms === 2250)).toBeDefined();
  });

  it('max retries exhausted → failed with Max retries exceeded', async () => {
    const onStatus = vi.fn();
    const client = makeMockClient({
      connect: async () => {
        throw new Error('down');
      },
    });
    const clock = makeFakeClock();
    const monitor = makeMonitor(makeFactory(client), clock, onStatus, vi.fn(), {
      ...defaultOptions,
      maxRetries: 2,
    });

    await monitor.start();
    while (clock.handlers.length > 0) {
      const h = clock.handlers.shift()!;
      await h.fn();
    }

    expect(
      onStatus.mock.calls.some(
        (c) => c[0].state === 'failed' && c[0].lastError === 'Max retries exceeded',
      ),
    ).toBe(true);
  });

  it('forceReconnect resets and reaches healthy again', async () => {
    const onStatus = vi.fn();
    const clock = makeFakeClock();
    const monitor = makeMonitor(makeFactory(makeMockClient({})), clock, onStatus);

    await monitor.start();
    await monitor.forceReconnect();
    expect(onStatus.mock.calls.some((c) => c[0].state === 'healthy')).toBe(true);
  });

  it('stop() prevents further status changes from pending timers', async () => {
    const onStatus = vi.fn();
    const client = makeMockClient({
      connect: async () => {
        throw new Error('fail');
      },
    });
    const clock = makeFakeClock();
    const monitor = makeMonitor(makeFactory(client), clock, onStatus);

    await monitor.start();
    await monitor.stop();
    const count = onStatus.mock.calls.length;
    while (clock.handlers.length > 0) {
      const h = clock.handlers.shift()!;
      await h.fn();
    }
    expect(onStatus.mock.calls.length).toBe(count);
  });

  it('wakeUp schedules ping in 500ms when connected', async () => {
    const onStatus = vi.fn();
    const ping = vi.fn(async () => {});
    const clock = makeFakeClock();
    const monitor = makeMonitor(makeFactory(makeMockClient({ ping })), clock, onStatus);

    await monitor.start();
    clock.handlers.length = 0;
    monitor.wakeUp();
    const wake = clock.handlers.find((h) => h.ms === 500);
    expect(wake).toBeDefined();
    await runHandler(wake!);
    expect(ping).toHaveBeenCalled();
  });

  it('interval mode: successful probe closes client and schedules next cycle', async () => {
    const onStatus = vi.fn();
    const close = vi.fn(async () => {});
    const clock = makeFakeClock();
    const monitor = makeMonitor(makeFactory(makeMockClient({ close })), clock, onStatus, vi.fn(), {
      ...defaultOptions,
      probeMode: 'interval',
    });

    await monitor.start();
    expect(close).toHaveBeenCalled();
    expect(onStatus.mock.calls.at(-1)?.[0].state).toBe('healthy');
    expect(clock.handlers.some((h) => h.ms === 30_000)).toBe(true);
  });

  it('interval mode failure schedules retry backoff', async () => {
    const onStatus = vi.fn();
    const close = vi.fn(async () => {});
    const client = makeMockClient({
      connect: async () => {
        throw new Error('down');
      },
      close,
    });
    const clock = makeFakeClock();
    const monitor = makeMonitor(makeFactory(client), clock, onStatus, vi.fn(), {
      ...defaultOptions,
      probeMode: 'interval',
      maxRetries: 2,
    });

    await monitor.start();
    expect(clock.handlers.some((h) => h.ms === 1000)).toBe(true);
    expect(onStatus.mock.calls.some((c) => c[0].state === 'degraded')).toBe(true);
  });

  it('interval wakeUp schedules probe in 500ms', async () => {
    const onStatus = vi.fn();
    const clock = makeFakeClock();
    const monitor = makeMonitor(makeFactory(makeMockClient({})), clock, onStatus, vi.fn(), {
      ...defaultOptions,
      probeMode: 'interval',
    });

    await monitor.start();
    clock.handlers.length = 0;
    monitor.wakeUp();
    const wake = clock.handlers.find((h) => h.ms === 500);
    expect(wake).toBeDefined();
    await runHandler(wake!);
    expect(onStatus.mock.calls.some((c) => c[0].state === 'healthy')).toBe(true);
  });

  it('wakeUp reconnects when disconnected (client null, not stopped)', async () => {
    const onStatus = vi.fn();
    const connect = vi.fn(async () => {});
    const clock = makeFakeClock();
    const monitor = makeMonitor(makeFactory(makeMockClient({ connect })), clock, onStatus);

    monitor.wakeUp();
    const wake = clock.handlers.find((h) => h.ms === 500);
    expect(wake).toBeDefined();
    await runHandler(wake!);
    expect(connect).toHaveBeenCalled();
  });
});
