export type ProbeMode = 'interval' | 'persistent';

export interface MonitorOptions {
  probeMode: ProbeMode;
  pingIntervalMs: number;
  pingTimeoutMs: number;
  maxRetries: number;
  initialBackoffMs: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
  /** After a successful ping, call listTools and expose toolCount (advisory only). */
  checkEmptyTools?: boolean;
  /**
   * After listTools, fingerprint tool names and set toolDrift when the set changes.
   * Also triggers listTools when checkEmptyTools is false.
   */
  detectToolDrift?: boolean;
  /**
   * Interval + HTTP only: HEAD/GET the URL before a full MCP connect.
   * If the endpoint is reachable but MCP ping fails → degraded with an advisory lastError.
   */
  passiveHttpProbe?: boolean;
  /** Injected for tests — defaults to global fetch. */
  passiveHttpFetch?: import('./passiveHttp').FetchLike;
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
