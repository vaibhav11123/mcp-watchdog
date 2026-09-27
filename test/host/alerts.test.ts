import * as assert from 'assert';
import { execSync } from 'child_process';
import * as vscode from 'vscode';
import { activateWatchdog, delay, ECHO, setupEchoOnlyHost, type McpWatchdogApi } from './helpers';

function killEchoServer(): void {
  try {
    execSync("pkill -9 -f 'echo-server.js'", { stdio: 'ignore' });
  } catch {
    // already dead
  }
}

function matchingEchoAlert(api: McpWatchdogApi) {
  const alert = api.getLastAlert();
  if (
    alert &&
    alert.server === ECHO &&
    (alert.kind === 'error' || alert.kind === 'warning') &&
    alert.actions.includes('Reconnect') &&
    alert.actions.includes('Reload Window')
  ) {
    return alert;
  }
  return undefined;
}

suite('MCP Watchdog alerts (host)', () => {
  test('kill echo server → alert with Reconnect and Reload Window', async function () {
    this.timeout(90_000);

    const cfg = vscode.workspace.getConfiguration('mcpWatchdog');
    const api = await activateWatchdog();

    await setupEchoOnlyHost(api, { requireApproval: false });
    await cfg.update('pingIntervalMs', 2000, vscode.ConfigurationTarget.Workspace);
    await cfg.update('degradedAlertDelayMs', 2500, vscode.ConfigurationTarget.Workspace);
    await cfg.update('notify', 'failures', vscode.ConfigurationTarget.Workspace);
    await vscode.commands.executeCommand('mcpWatchdog.refresh');

    const healthyDeadline = Date.now() + 45_000;
    while (Date.now() < healthyDeadline) {
      if (api.getStatuses().some((s) => s.name === ECHO && s.state === 'healthy')) {
        break;
      }
      await delay(500);
    }
    assert.ok(
      api.getStatuses().some((s) => s.name === ECHO && s.state === 'healthy'),
      `echo should be healthy; statuses=${JSON.stringify(api.getStatuses())}`,
    );

    // Keep killing so persistent reconnect cannot race back to healthy before
    // the degraded delay (or max-retries → failed) can emit an alert.
    killEchoServer();
    const killTimer = setInterval(killEchoServer, 400);

    try {
      const observeDeadline = Date.now() + 40_000;
      let sawBad = false;
      let alert = matchingEchoAlert(api);

      while (Date.now() < observeDeadline) {
        const echo = api.getStatuses().find((x) => x.name === ECHO);
        if (echo && (echo.state === 'degraded' || echo.state === 'failed')) {
          sawBad = true;
        }
        alert = matchingEchoAlert(api);
        if (sawBad && alert) {
          break;
        }
        await delay(400);
      }

      assert.ok(
        sawBad,
        `echo should be degraded/failed at least once; statuses=${JSON.stringify(api.getStatuses())}`,
      );
      assert.ok(
        alert,
        `expected echo alert; last=${JSON.stringify(api.getLastAlert())}; statuses=${JSON.stringify(api.getStatuses())}`,
      );
      assert.strictEqual(alert!.server, ECHO);
      assert.ok(alert!.actions.includes('Reconnect') && alert!.actions.includes('Reload Window'));
      assert.match(alert!.message, /echo/i);
    } finally {
      clearInterval(killTimer);
    }
  });
});
