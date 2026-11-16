import { causeSentence } from '../../packages/probe-core/src/diagnostics/causeSentence';
import type { McpServerConfig } from '../config-core';
import { diagnoseFailure } from '../failureTriage';
import { ServerMonitor, type ServerStatus } from '../monitor';
import type { MonitorOptions } from '../options';

const DEFAULT_OPTS: MonitorOptions = {
  probeMode: 'interval',
  pingIntervalMs: 30_000,
  pingTimeoutMs: 8_000,
  maxRetries: 1,
  initialBackoffMs: 500,
  backoffMultiplier: 2,
  maxBackoffMs: 2_000,
};

export interface CliServerReport {
  name: string;
  state: ServerStatus['state'];
  causeId?: string;
  sentence?: string;
  actions?: Array<{ id: string; label: string }>;
  hostConnection: 'unknown';
  lastError?: string;
  origin?: { path: string; label: string };
}

/** One-shot Watchdog probe (interval cycle) — never prints env/header values. */
export async function probeServerOnce(
  name: string,
  config: McpServerConfig,
  opts: Partial<MonitorOptions> = {},
): Promise<CliServerReport> {
  let last: ServerStatus | undefined;
  const monitor = new ServerMonitor(
    name,
    config,
    { ...DEFAULT_OPTS, ...opts },
    (s) => {
      last = { ...s };
    },
    () => {
      /* silent — CLI report carries status */
    },
  );

  try {
    await monitor.start();
  } finally {
    await monitor.stop().catch(() => {});
  }

  const status = last ?? {
    name,
    state: 'failed' as const,
    retryCount: 0,
    lastError: 'No status from probe',
  };

  if (status.state === 'healthy' || status.state === 'connecting') {
    return {
      name,
      state: status.state,
      hostConnection: 'unknown',
      origin: undefined,
    };
  }

  const diagnosis = diagnoseFailure({
    serverName: name,
    lastError: status.lastError,
    lastProbeError: status.lastProbeError,
    failureContext: status.failureContext,
    config,
  });

  return {
    name,
    state: status.state,
    causeId: diagnosis.causeId,
    sentence: causeSentence(diagnosis.causeId),
    actions: diagnosis.actions.map((a) => ({ id: a.id, label: a.label })),
    hostConnection: 'unknown',
    lastError: status.lastError ? String(status.lastError).slice(0, 200) : undefined,
  };
}
