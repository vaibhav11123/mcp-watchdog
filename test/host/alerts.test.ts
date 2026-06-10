import * as assert from 'assert';
import { execSync } from 'child_process';
import * as vscode from 'vscode';

const EXT_ID = 'mcp-watchdog.mcp-watchdog';
const TARGET = 'echo';

interface McpWatchdogApi {
  getStatuses(): Array<{ name: string; state: string }>;
  getLastAlert(): { kind: string; message: string; actions: string[]; server: string } | undefined;
}

suite('MCP Watchdog alerts (host)', () => {
  test('kill echo server → alert with Reconnect and Reload Window', async function () {
    this.timeout(90_000);

    const cfg = vscode.workspace.getConfiguration('mcpWatchdog');
    await cfg.update('requireApproval', false, vscode.ConfigurationTarget.Workspace);
    await cfg.update('pingIntervalMs', 2000, vscode.ConfigurationTarget.Workspace);
    await cfg.update('degradedAlertDelayMs', 2500, vscode.ConfigurationTarget.Workspace);
    await cfg.update('notify', 'failures', vscode.ConfigurationTarget.Workspace);
    await cfg.update(
      'perServer',
      { memory: { enabled: false }, filesystem: { enabled: false } },
      vscode.ConfigurationTarget.Workspace,
    );

    const ext = vscode.extensions.getExtension(EXT_ID);
    const api = (await ext!.activate()) as McpWatchdogApi;
    await vscode.commands.executeCommand('mcpWatchdog.refresh');

    const healthyDeadline = Date.now() + 45_000;
    while (Date.now() < healthyDeadline) {
      if (api.getStatuses().some((s) => s.name === TARGET && s.state === 'healthy')) {
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.ok(
      api.getStatuses().some((s) => s.name === TARGET && s.state === 'healthy'),
      `echo should be healthy; statuses=${JSON.stringify(api.getStatuses())}`,
    );
    try {
      execSync("pkill -9 -f 'echo-server.js'", { stdio: 'ignore' });
    } catch {
      // already dead — next ping should still fail
    }
    await new Promise((r) => setTimeout(r, 500));

    const degradeDeadline = Date.now() + 20_000;
    while (Date.now() < degradeDeadline) {
      const s = api.getStatuses().find((x) => x.name === TARGET);
      if (s && (s.state === 'degraded' || s.state === 'failed')) {
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    const afterKill = api.getStatuses().find((x) => x.name === TARGET);
    assert.ok(
      afterKill && (afterKill.state === 'degraded' || afterKill.state === 'failed'),
      `echo should be degraded/failed; got ${JSON.stringify(afterKill)}`,
    );

    const alertDeadline = Date.now() + 30_000;
    let alert = api.getLastAlert();
    while (Date.now() < alertDeadline) {
      alert = api.getLastAlert();
      if (
        alert &&
        alert.server === TARGET &&
        (alert.kind === 'error' || alert.kind === 'warning') &&
        alert.actions.includes('Reconnect') &&
        alert.actions.includes('Reload Window')
      ) {
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    assert.ok(alert, `expected alert; statuses=${JSON.stringify(api.getStatuses())}`);
    assert.strictEqual(alert!.server, TARGET);
    assert.ok(alert!.actions.includes('Reconnect') && alert!.actions.includes('Reload Window'));
    assert.match(alert!.message, /echo/i);
  });
});
