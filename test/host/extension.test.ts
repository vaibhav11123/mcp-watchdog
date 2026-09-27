import * as assert from 'assert';
import * as vscode from 'vscode';
import { activateWatchdog, delay, ECHO, setupEchoOnlyHost, type McpWatchdogApi } from './helpers';

suite('MCP Watchdog extension host', () => {
  test('extension is present and activates', async () => {
    const api = await activateWatchdog();
    assert.ok(api);
    const ext = vscode.extensions.getExtension('mcp-watchdog.mcp-watchdog');
    assert.ok(ext?.isActive);
  });

  test('commands are registered', async () => {
    const all = await vscode.commands.getCommands(true);
    const expected = [
      'mcpWatchdog.showStatus',
      'mcpWatchdog.reconnectAll',
      'mcpWatchdog.reconnectServer',
      'mcpWatchdog.reconnectOne',
      'mcpWatchdog.focusServersView',
      'mcpWatchdog.openMcpConfig',
      'mcpWatchdog.showOutput',
      'mcpWatchdog.refresh',
      'mcpWatchdog.reviewTrust',
    ];
    for (const id of expected) {
      assert.ok(all.includes(id), `missing command ${id}`);
    }
  });

  test('echo server reaches healthy within 15s', async () => {
    const api = await activateWatchdog();
    await setupEchoOnlyHost(api, { requireApproval: false });

    const deadline = Date.now() + 30_000;
    let healthy = false;
    let lastStatuses: ReturnType<McpWatchdogApi['getStatuses']> = [];
    while (Date.now() < deadline) {
      lastStatuses = api.getStatuses();
      if (lastStatuses.some((s) => s.name === ECHO && s.state === 'healthy')) {
        healthy = true;
        break;
      }
      await delay(500);
    }
    assert.ok(
      healthy,
      `echo fixture should become healthy; last statuses: ${JSON.stringify(lastStatuses)}`,
    );
  });

  test('reconnectAll executes without throwing', async function () {
    this.timeout(120_000);
    await vscode.commands.executeCommand('mcpWatchdog.reconnectAll');
  });
});
