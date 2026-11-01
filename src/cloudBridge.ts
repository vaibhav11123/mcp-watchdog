/**
 * Opt-in IDE→Cloud bridge helper (vscode-free).
 * Names-only payloads via scrubBridgePayload; fail soft on network errors.
 */
import { createHash, randomUUID } from 'crypto';
import { scrubBridgePayload } from './bridge/scrub';
import type { BridgePayload, BridgeServerState } from '../packages/probe-core/src/bridge/schema';
import { BRIDGE_SCHEMA_VERSION } from '../packages/probe-core/src/bridge/schema';
import type { McpServerConfig } from './config-core';
import type { ServerState } from './monitor';
import { envNamesOf, headerNamesOf } from './vendorRecipes';

export interface BridgePostResult {
  ok: boolean;
  status?: number;
  error?: string;
}

export function workspaceIdHash(folderPathsJoined: string): string {
  return createHash('sha256')
    .update(folderPathsJoined || 'no-workspace')
    .digest('hex')
    .slice(0, 32);
}

export function buildBridgePayload(input: {
  workspaceIdHash: string;
  extensionVersion: string;
  serverName: string;
  config?: McpServerConfig;
  stateFrom: ServerState;
  stateTo: ServerState;
  accepted?: boolean;
  toolCount?: number;
  toolDrift?: boolean;
  errorClass?: 'auth' | 'timeout' | 'protocol' | 'unknown';
  at?: string;
}): BridgePayload {
  const transport =
    input.config?.type === 'stdio'
      ? 'stdio'
      : input.config?.type === 'sse'
        ? 'sse'
        : input.config?.type === 'http'
          ? 'http'
          : 'stdio';
  const commandName =
    input.config?.type === 'stdio' ? input.config.command.split(/[/\\]/).pop() : undefined;
  const urlHost =
    input.config && (input.config.type === 'http' || input.config.type === 'sse')
      ? (() => {
          try {
            return new URL(input.config.url).hostname;
          } catch {
            return undefined;
          }
        })()
      : undefined;

  return {
    schemaVersion: BRIDGE_SCHEMA_VERSION,
    workspaceIdHash: input.workspaceIdHash,
    extensionVersion: input.extensionVersion,
    optIn: true,
    incident: {
      id: randomUUID(),
      serverName: input.serverName,
      transport,
      urlHost,
      commandName,
      stateFrom: input.stateFrom as BridgeServerState,
      stateTo: input.stateTo as BridgeServerState,
      errorClass: input.errorClass,
      toolCount: input.toolCount,
      toolDrift: input.toolDrift,
      headerNames: headerNamesOf(input.config),
      envNames: envNamesOf(input.config),
      at: input.at ?? new Date().toISOString(),
      ...(input.accepted !== undefined ? { accepted: input.accepted } : {}),
    },
  };
}

export async function postBridgeIncident(
  baseUrl: string,
  payload: BridgePayload,
  fetchImpl: typeof fetch = fetch,
): Promise<BridgePostResult> {
  const scrubbed = scrubBridgePayload(payload);
  if (!scrubbed.ok) {
    return { ok: false, error: scrubbed.error };
  }
  const root = baseUrl.replace(/\/+$/, '');
  try {
    const res = await fetchImpl(`${root}/v1/bridge/incidents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scrubbed.payload),
    });
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
