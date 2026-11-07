import * as vscode from 'vscode';

export const EXT_ID = 'mcp-watchdog.mcp-watchdog';
export const ECHO = 'echo';

export interface McpWatchdogApi {
  getStatuses(): Array<{
    name: string;
    state: string;
    lastError?: string;
    accepted?: boolean;
    verifiedOutcome?: string;
  }>;
  getLastAlert(): { kind: string; message: string; actions: string[]; server: string } | undefined;
  revokeTrustForTests(): Promise<void>;
  acceptFailureForTests(serverName: string): Promise<void>;
  removeServerForTests(serverName: string): Promise<void>;
  setVerifiedOutcomeForTests(
    serverName: string,
    outcome: 'resolved' | 'unresolved' | 'unknown' | 'worsened',
  ): void;
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
  // Workspace target writes mcp-watchdog-test/.vscode/settings.json (window-scoped setting).
  await cfg.update('requireApproval', opts.requireApproval, vscode.ConfigurationTarget.Workspace);
  // Ensure the configuration service has applied the write before any reload.
  await delay(300);
  const applied = vscode.workspace
    .getConfiguration('mcpWatchdog')
    .get<boolean>('requireApproval', true);
  if (applied !== opts.requireApproval) {
    throw new Error(
      `requireApproval update failed: wanted ${opts.requireApproval}, got ${applied}`,
    );
  }

  // Discover names without starting probes when gated: revoke first.
  if (opts.requireApproval) {
    await api.revokeTrustForTests();
  } else {
    await vscode.commands.executeCommand('mcpWatchdog.refresh');
  }
  await delay(400);

  const discovered = new Set(api.getStatuses().map((s) => s.name));
  for (const known of [
    'memory',
    'filesystem',
    'filesystem-vendored',
    'filesystem-vendored-fail',
    ECHO,
  ]) {
    discovered.add(known);
  }

  const perServer: Record<string, { enabled?: boolean; probeMode?: 'interval' | 'persistent' }> =
    {};
  for (const name of discovered) {
    perServer[name] =
      name === ECHO ? { enabled: true, probeMode: 'persistent' } : { enabled: false };
  }

  await cfg.update('perServer', perServer, vscode.ConfigurationTarget.Workspace);
  await delay(200);

  if (opts.requireApproval) {
    await api.revokeTrustForTests();
  } else {
    await vscode.commands.executeCommand('mcpWatchdog.refresh');
  }
  await delay(500);
}
