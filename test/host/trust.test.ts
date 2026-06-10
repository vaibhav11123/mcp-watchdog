import * as assert from 'assert';
import * as vscode from 'vscode';

const EXT_ID = 'mcp-watchdog.mcp-watchdog';

interface McpWatchdogApi {
  getStatuses(): Array<{ name: string; state: string; lastError?: string }>;
  revokeTrustForTests(): Promise<void>;
}

suite('MCP Watchdog trust gate (host)', () => {
  test('requireApproval=true blocks monitoring until trusted', async () => {
    const cfg = vscode.workspace.getConfiguration('mcpWatchdog');
    const ext = vscode.extensions.getExtension(EXT_ID);
    const api = (await ext!.activate()) as McpWatchdogApi;

    try {
      await api.revokeTrustForTests();
      await cfg.update('requireApproval', true, vscode.ConfigurationTarget.Workspace);
      await vscode.commands.executeCommand('mcpWatchdog.refresh');
      await new Promise((r) => setTimeout(r, 1500));

      const statuses = api.getStatuses();
      const echo = statuses.find((s) => s.name === 'echo');
      assert.ok(echo, 'echo server should appear as placeholder');
      assert.notEqual(echo!.state, 'healthy', 'echo must not be healthy without approval');
      assert.ok(
        echo!.lastError?.includes('Awaiting approval') || echo!.state === 'disconnected',
        'untrusted placeholder expected',
      );
    } finally {
      await cfg.update('requireApproval', false, vscode.ConfigurationTarget.Workspace);
      await vscode.commands.executeCommand('mcpWatchdog.refresh');
    }
  });
});
