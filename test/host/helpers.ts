import * as vscode from 'vscode';

export const EXT_ID = 'mcp-watchdog.mcp-watchdog';
export const ECHO = 'echo';

export interface McpWatchdogApi {
  getStatuses(): Array<{ name: string; state: string; lastError?: string }>;
  getLastAlert(): { kind: string; message: string; actions: string[]; server: string } | undefined;
  revokeTrustForTests(): Promise<void>;
}

export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function activateWatchdog(): Promise<McpWatchdogApi> {
  const ext = vscode.extensions.getExtension(EXT_ID);
  if (!ext) {
    throw new Error(`Extension ${EXT_ID} not found`);
  }
  return (await ext.activate()) as McpWatchdogApi;
}

/**
 * Host-test isolation: force requireApproval, disable every discovered server
 * except echo (including globals merged from ~/.cursor/mcp.json), optionally
 * revoke trust, then refresh.
 */
export async function setupEchoOnlyHost(
  api: McpWatchdogApi,
  opts: { requireApproval: boolean },
): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('mcpWatchdog');
  await cfg.update('requireApproval', opts.requireApproval, vscode.ConfigurationTarget.Workspace);

  // Discover merged server names (workspace + global) before locking perServer.
  await vscode.commands.executeCommand('mcpWatchdog.refresh');
  await delay(400);

  const discovered = new Set(api.getStatuses().map((s) => s.name));
  for (const known of ['memory', 'filesystem', ECHO]) {
    discovered.add(known);
  }

  const perServer: Record<string, { enabled?: boolean; probeMode?: 'interval' | 'persistent' }> =
    {};
  for (const name of discovered) {
    perServer[name] =
      name === ECHO ? { enabled: true, probeMode: 'persistent' } : { enabled: false };
  }

  await cfg.update('perServer', perServer, vscode.ConfigurationTarget.Workspace);

  if (opts.requireApproval) {
    await api.revokeTrustForTests();
  } else {
    await vscode.commands.executeCommand('mcpWatchdog.refresh');
  }
  await delay(300);
}
