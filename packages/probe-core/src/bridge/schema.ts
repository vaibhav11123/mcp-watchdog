/** Allowlisted IDE→cloud bridge payload (names only — never secret values). */

export const BRIDGE_SCHEMA_VERSION = 1 as const;

export type BridgeServerState =
  | 'connecting'
  | 'healthy'
  | 'degraded'
  | 'failed'
  | 'disconnected';

export interface BridgeIncident {
  id: string;
  serverName: string;
  transport: 'stdio' | 'http' | 'sse';
  /** Host only — no query/fragment. */
  urlHost?: string;
  /** Binary name only. */
  commandName?: string;
  stateFrom: BridgeServerState;
  stateTo: BridgeServerState;
  errorClass?: 'auth' | 'timeout' | 'protocol' | 'unknown';
  toolCount?: number;
  toolDrift?: boolean;
  headerNames?: string[];
  envNames?: string[];
  at: string;
}

export interface BridgePayload {
  schemaVersion: typeof BRIDGE_SCHEMA_VERSION;
  workspaceIdHash: string;
  extensionVersion: string;
  optIn: true;
  incident: BridgeIncident;
}

/** Keys that must never appear (secret carriers). */
export const REJECTED_PAYLOAD_KEYS = [
  'env',
  'headers',
  'authorization',
  'token',
  'apiKey',
  'api_key',
  'cookie',
  'password',
  'secret',
] as const;
