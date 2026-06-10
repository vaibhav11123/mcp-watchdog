export type ProbeMode = 'interval' | 'persistent';

export interface MonitorOptions {
  probeMode: ProbeMode;
  pingIntervalMs: number;
  pingTimeoutMs: number;
  maxRetries: number;
  initialBackoffMs: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
  /** Injected for tests — defaults to Math.random. Use () => 0.5 for no jitter. */
  jitterRand?: () => number;
}

/** ±10% jitter on scheduled delays to avoid thundering herd. */
export function jittered(ms: number, rand = Math.random): number {
  const factor = 0.9 + rand() * 0.2;
  return Math.round(ms * factor);
}

export function debounce<F extends (...args: never[]) => void>(fn: F, waitMs: number): F {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return ((...args: never[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, waitMs);
  }) as F;
}

export interface PerServerOverride {
  probeMode?: ProbeMode;
  pingIntervalMs?: number;
  enabled?: boolean;
}

export interface ResolvedServerOptions {
  enabled: boolean;
  options: MonitorOptions;
}

export function resolveServerOptions(
  globals: MonitorOptions,
  perServer: Record<string, PerServerOverride> | undefined,
  name: string,
): ResolvedServerOptions {
  const override = perServer?.[name];
  if (override?.enabled === false) {
    return { enabled: false, options: globals };
  }
  return {
    enabled: true,
    options: {
      ...globals,
      probeMode: override?.probeMode ?? globals.probeMode,
      pingIntervalMs: override?.pingIntervalMs ?? globals.pingIntervalMs,
    },
  };
}
