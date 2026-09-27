import * as assert from 'assert';
import * as vscode from 'vscode';
import { activateWatchdog, delay, setupEchoOnlyHost } from './helpers';

suite('MCP Watchdog trust gate (host)', () => {
  test('requireApproval=true blocks monitoring until trusted', async () => {
    const cfg = vscode.workspace.getConfiguration('mcpWatchdog');
    const api = await activateWatchdog();

    try {
      // Gate on first, then revoke so reload sees an empty trust store.
      await setupEchoOnlyHost(api, { requireApproval: true });
      await delay(1000);

      const statuses = api.getStatuses();
      const echo = statuses.find((s) => s.name === 'echo');
      assert.ok(
        echo,
        `echo server should appear as placeholder; statuses=${JSON.stringify(statuses)}`,
      );
      assert.notEqual(echo!.state, 'healthy', 'echo must not be healthy without approval');
      assert.ok(
        echo!.lastError?.includes('Awaiting approval') || echo!.state === 'disconnected',
        `untrusted placeholder expected; got ${JSON.stringify(echo)}`,
      );
    } finally {
      await cfg.update('requireApproval', false, vscode.ConfigurationTarget.Workspace);
      await vscode.commands.executeCommand('mcpWatchdog.refresh');
    }
  });
});
