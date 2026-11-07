import type { TelemetryEventName } from './events';

/** Flat allowlisted keys (plus nested $set / $set_once). */
export const ALLOWED_PROP_KEYS = new Set([
  'extVersion',
  'editor',
  'vscodeVersion',
  'serverCount',
  'monitoringCount',
  'probeMode',
  'cloudBridgeEnabled',
  'authProbeEnabledCount',
  'transport',
  'stateFrom',
  'stateTo',
  'failureClass',
  'causeId',
  'action',
  'surface',
  'fixStepId',
  'outcome',
  'allowedCount',
  'key',
  'value',
  'where',
  'name',
  'command',
  'method',
  '$lib',
  '$set',
  '$set_once',
]);

const BANNED_KEY_SUBSTR = [
  'password',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'header',
  'env',
  'path',
  'args',
  // 'command' is allowlisted as ui_command prop — ban substring only for non-allowlisted keys
  'url',
  'error',
  'stack',
  'email',
  'workspace',
  'machine',
  'clipboard',
];

export const EVENT_NAMES = new Set<string>([
  'activation',
  'state_transition',
  'triage_action',
  'trust_decision',
  'settings_change',
  'error',
  'ui_command',
]);

export type ScrubbedValue = string | number | boolean | Record<string, string | number | boolean>;
export type ScrubbedProps = Record<string, ScrubbedValue>;

function isBannedKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (ALLOWED_PROP_KEYS.has(key)) return false;
  return BANNED_KEY_SUBSTR.some((b) => lower.includes(b));
}

function isPrimitive(v: unknown): v is string | number | boolean {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

function scrubPrimitive(value: unknown): string | number | boolean | undefined {
  if (!isPrimitive(value)) return undefined;
  if (typeof value === 'string') return value.length > 200 ? value.slice(0, 200) : value;
  return value;
}

function scrubNested(value: unknown): Record<string, string | number | boolean> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const nested: Record<string, string | number | boolean> = {};
  for (const [nk, nv] of Object.entries(value as Record<string, unknown>)) {
    if (isBannedKey(nk)) continue;
    const p = scrubPrimitive(nv);
    if (p === undefined) continue;
    nested[nk] = p;
  }
  return nested;
}

/**
 * Allowlist-only scrub. Drops unknown keys, banned substrings, and non-primitives
 * (except `$set` / `$set_once` plain objects of primitives).
 */
export function scrubProperties(raw: Record<string, unknown> | undefined): ScrubbedProps {
  if (!raw) return {};
  const out: ScrubbedProps = {};
  for (const [key, value] of Object.entries(raw)) {
    if (isBannedKey(key)) continue;
    if (!ALLOWED_PROP_KEYS.has(key)) continue;
    if (key === '$set' || key === '$set_once') {
      let candidate: unknown = value;
      if (typeof value === 'string') {
        try {
          candidate = JSON.parse(value) as unknown;
        } catch {
          continue;
        }
      }
      const nested = scrubNested(candidate);
      if (nested) out[key] = nested;
      continue;
    }
    const p = scrubPrimitive(value);
    if (p !== undefined) out[key] = p;
  }
  return out;
}

export function isAllowedEvent(name: string): name is TelemetryEventName {
  return EVENT_NAMES.has(name);
}

/** Final properties for PostHog capture (always includes $lib). */
export function materializeCaptureProperties(scrubbed: ScrubbedProps): Record<string, unknown> {
  return { $lib: 'mcp-watchdog', ...scrubbed };
}
