import {
  BRIDGE_SCHEMA_VERSION,
  REJECTED_PAYLOAD_KEYS,
  type BridgePayload,
  type BridgeServerState,
} from './schema';

export type ScrubResult =
  | { ok: true; payload: BridgePayload }
  | { ok: false; status: 400; error: string };

const STATES: ReadonlySet<string> = new Set([
  'connecting',
  'healthy',
  'degraded',
  'failed',
  'disconnected',
]);

function deepHasRejectedKey(value: unknown, path: string[]): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = deepHasRejectedKey(value[i], [...path, String(i)]);
      if (hit) return hit;
    }
    return undefined;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const lower = k.toLowerCase();
    if (
      REJECTED_PAYLOAD_KEYS.some((r) => r.toLowerCase() === lower) ||
      lower.includes('password') ||
      lower.includes('secret')
    ) {
      // Allow headerNames / envNames (names only)
      if (k === 'headerNames' || k === 'envNames') {
        const nested = deepHasRejectedKey(v, [...path, k]);
        if (nested) return nested;
        continue;
      }
      return [...path, k].join('.');
    }
    const nested = deepHasRejectedKey(v, [...path, k]);
    if (nested) return nested;
  }
  return undefined;
}

/** Strip query/fragment; return hostname only. */
export function hostOnly(urlOrHost: string): string {
  try {
    if (urlOrHost.includes('://')) {
      return new URL(urlOrHost).hostname;
    }
    return urlOrHost.split('/')[0]?.split('?')[0] ?? urlOrHost;
  } catch {
    return urlOrHost.split('?')[0] ?? urlOrHost;
  }
}

function isState(s: unknown): s is BridgeServerState {
  return typeof s === 'string' && STATES.has(s);
}

/**
 * Validate and scrub a bridge payload. Fail closed on secret-bearing keys.
 */
export function scrubBridgePayload(raw: unknown): ScrubResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, status: 400, error: 'payload must be an object' };
  }
  const rejected = deepHasRejectedKey(raw, []);
  if (rejected) {
    return {
      ok: false,
      status: 400,
      error: `rejected key path: ${rejected}`,
    };
  }

  const o = raw as Record<string, unknown>;
  if (o.optIn !== true) {
    return { ok: false, status: 400, error: 'optIn must be true' };
  }
  if (o.schemaVersion !== BRIDGE_SCHEMA_VERSION) {
    return { ok: false, status: 400, error: 'unsupported schemaVersion' };
  }
  if (typeof o.workspaceIdHash !== 'string' || !o.workspaceIdHash) {
    return { ok: false, status: 400, error: 'workspaceIdHash required' };
  }
  if (typeof o.extensionVersion !== 'string') {
    return { ok: false, status: 400, error: 'extensionVersion required' };
  }
  const inc = o.incident;
  if (!inc || typeof inc !== 'object') {
    return { ok: false, status: 400, error: 'incident required' };
  }
  const i = inc as Record<string, unknown>;
  if (typeof i.id !== 'string' || typeof i.serverName !== 'string') {
    return { ok: false, status: 400, error: 'incident.id and serverName required' };
  }
  if (i.transport !== 'stdio' && i.transport !== 'http' && i.transport !== 'sse') {
    return { ok: false, status: 400, error: 'invalid transport' };
  }
  if (!isState(i.stateFrom) || !isState(i.stateTo)) {
    return { ok: false, status: 400, error: 'invalid stateFrom/stateTo' };
  }
  if (typeof i.at !== 'string') {
    return { ok: false, status: 400, error: 'incident.at required' };
  }

  let urlHost: string | undefined;
  if (typeof i.urlHost === 'string') {
    urlHost = hostOnly(i.urlHost);
  }

  const headerNames = Array.isArray(i.headerNames)
    ? i.headerNames.filter((x): x is string => typeof x === 'string')
    : undefined;
  const envNames = Array.isArray(i.envNames)
    ? i.envNames.filter((x): x is string => typeof x === 'string')
    : undefined;

  const payload: BridgePayload = {
    schemaVersion: BRIDGE_SCHEMA_VERSION,
    workspaceIdHash: o.workspaceIdHash,
    extensionVersion: o.extensionVersion,
    optIn: true,
    incident: {
      id: i.id,
      serverName: i.serverName,
      transport: i.transport,
      urlHost,
      commandName: typeof i.commandName === 'string' ? i.commandName : undefined,
      stateFrom: i.stateFrom,
      stateTo: i.stateTo,
      errorClass:
        i.errorClass === 'auth' ||
        i.errorClass === 'timeout' ||
        i.errorClass === 'protocol' ||
        i.errorClass === 'unknown'
          ? i.errorClass
          : undefined,
      toolCount: typeof i.toolCount === 'number' ? i.toolCount : undefined,
      toolDrift: typeof i.toolDrift === 'boolean' ? i.toolDrift : undefined,
      headerNames,
      envNames,
      at: i.at,
    },
  };

  return { ok: true, payload };
}
