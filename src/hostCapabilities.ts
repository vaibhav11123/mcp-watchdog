/**
 * Thin HostCapabilities adapters (ARCH §9 / §9b).
 * vscode-free detection helpers live here; command probing uses EditorMcpHost.
 */
import {
  editorMcpCommandsAvailable,
  type EditorMcpHost,
} from './editorMcp';

export type HostId = 'cursor' | 'vscode' | 'windsurf' | 'antigravity' | 'unknown';

export interface HostCapabilities {
  hostId: HostId;
  hostVersion?: string;
  canReadMcpConfig: boolean;
  /** Always false until a documented host status API exists. */
  canObserveConnectionState: boolean;
  canRestartServer: boolean;
  canRestartWindow: boolean;
  canAccessToolCatalog: boolean;
}

export interface HostEnvLike {
  appName?: string;
  appRoot?: string;
  appHost?: string;
  uiKind?: string;
}

/** Map editor env heuristics → hostId (table-driven, Phase 2.1). */
export function detectHostId(env: HostEnvLike): HostId {
  const name = (env.appName || '').toLowerCase();
  const root = (env.appRoot || '').toLowerCase();
  const blob = `${name} ${root}`;

  if (blob.includes('cursor')) return 'cursor';
  if (blob.includes('windsurf') || blob.includes('codeium')) return 'windsurf';
  if (blob.includes('antigravity') || blob.includes('gemini')) return 'antigravity';
  if (
    blob.includes('visual studio code') ||
    blob.includes('vscode') ||
    name === 'code' ||
    name.includes('code - oss')
  ) {
    return 'vscode';
  }
  return 'unknown';
}

export function baseHostCapabilities(
  hostId: HostId,
  hostVersion?: string,
): HostCapabilities {
  return {
    hostId,
    hostVersion,
    canReadMcpConfig: true,
    // Cursor / forks: no public MCP session status API (ARCH §9b).
    canObserveConnectionState: false,
    canRestartServer: false,
    canRestartWindow: true,
    canAccessToolCatalog: false,
  };
}

/** Fill restart capability from workbench.mcp.* presence. */
export async function resolveHostCapabilities(
  env: HostEnvLike,
  editorHost: EditorMcpHost,
  hostVersion?: string,
): Promise<HostCapabilities> {
  const hostId = detectHostId(env);
  const caps = baseHostCapabilities(hostId, hostVersion);
  try {
    const cmds = await editorHost.getCommands(true);
    caps.canRestartServer = editorMcpCommandsAvailable(cmds);
  } catch {
    caps.canRestartServer = false;
  }
  return caps;
}
