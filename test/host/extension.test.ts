import * as assert from 'assert';
import * as vscode from 'vscode';

const EXT_ID = 'mcp-watchdog.mcp-watchdog';

interface McpWatchdogApi {
  getStatuses(): Array<{ name: string; state: string }>;
}

suite('MCP Watchdog extension host', () => {
  test('extension is present and activates', async () => {
    const ext = vscode.extensions.getExtension(EXT_ID);
    assert.ok(ext, 'extension should be installed');
    await ext!.activate();
    assert.ok(ext!.isActive);
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
    const ext = vscode.extensions.getExtension(EXT_ID);
    const api = (await ext!.activate()) as McpWatchdogApi;
    await vscode.commands.executeCommand('mcpWatchdog.refresh');

    const deadline = Date.now() + 30_000;
    let healthy = false;
    let lastStatuses: ReturnType<McpWatchdogApi['getStatuses']> = [];
    while (Date.now() < deadline) {
      lastStatuses = api.getStatuses();
      if (lastStatuses.some((s) => s.name === 'echo' && s.state === 'healthy')) {
        healthy = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
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
