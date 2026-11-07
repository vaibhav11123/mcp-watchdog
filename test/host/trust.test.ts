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
      await delay(1500);

      const gated = vscode.workspace
        .getConfiguration('mcpWatchdog')
        .get<boolean>('requireApproval', true);
      assert.strictEqual(gated, true, 'requireApproval must stay true during assertion');

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
