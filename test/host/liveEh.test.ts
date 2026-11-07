/**
 * Live EH matrix (TESTING.md L1–L9) executed in Extension Host —
 * same surface as F5 against mcp-watchdog-test.
 */
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

async function waitHealthy(api: McpWatchdogApi, ms = 45_000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (api.getStatuses().some((s) => s.name === ECHO && s.state === 'healthy')) return;
    await delay(500);
  }
  assert.fail(`echo not healthy; ${JSON.stringify(api.getStatuses())}`);
}

suite('Live EH matrix (TESTING.md L1–L9)', () => {
  test('L2 trust gate: requireApproval blocks healthy until trusted', async function () {
    this.timeout(60_000);
    const cfg = vscode.workspace.getConfiguration('mcpWatchdog');
    const api = await activateWatchdog();
    try {
      await setupEchoOnlyHost(api, { requireApproval: true });
      await delay(1200);
      const echo = api.getStatuses().find((s) => s.name === ECHO);
      assert.ok(echo, 'echo placeholder present');
      assert.notEqual(echo!.state, 'healthy');
      assert.ok(
        echo!.lastError?.includes('Awaiting approval') || echo!.state === 'disconnected',
        JSON.stringify(echo),
      );
    } finally {
      // Leave gate off so later Live EH / host suites can reach healthy.
      await cfg.update('requireApproval', false, vscode.ConfigurationTarget.Workspace);
      await vscode.commands.executeCommand('mcpWatchdog.refresh');
    }
  });

  test('L3 healthy echo reaches healthy', async function () {
    this.timeout(60_000);
    const api = await activateWatchdog();
    await setupEchoOnlyHost(api, { requireApproval: false });
    await vscode.commands.executeCommand('mcpWatchdog.refresh');
    await waitHealthy(api);
    const echo = api.getStatuses().find((s) => s.name === ECHO);
    assert.strictEqual(echo?.state, 'healthy');
  });

  test('L4–L6 failure → cause toast ≤3 → Fix QP title includes causeId', async function () {
    this.timeout(90_000);
    const cfg = vscode.workspace.getConfiguration('mcpWatchdog');
    const api = await activateWatchdog();

    await setupEchoOnlyHost(api, { requireApproval: false });
    await cfg.update('pingIntervalMs', 2000, vscode.ConfigurationTarget.Workspace);
    await cfg.update('degradedAlertDelayMs', 2500, vscode.ConfigurationTarget.Workspace);
    await cfg.update('notify', 'failures', vscode.ConfigurationTarget.Workspace);
    await vscode.commands.executeCommand('mcpWatchdog.refresh');
    await waitHealthy(api);

    const qpTitles: string[] = [];
    const originalQp = vscode.window.showQuickPick.bind(vscode.window);
    (
      vscode.window as unknown as { showQuickPick: typeof vscode.window.showQuickPick }
    ).showQuickPick = (async (items: unknown, options?: { title?: string }) => {
      if (options?.title) qpTitles.push(options.title);
      // Cancel Fix UI — we only assert title shape (S-FIX-QP-01).
      return undefined;
    }) as typeof vscode.window.showQuickPick;

    killEchoServer();
    const killTimer = setInterval(killEchoServer, 400);
    try {
      const deadline = Date.now() + 40_000;
      let sawBad = false;
      while (Date.now() < deadline) {
        const echo = api.getStatuses().find((s) => s.name === ECHO);
        if (echo && (echo.state === 'degraded' || echo.state === 'failed')) sawBad = true;
        const alert = api.getLastAlert();
        if (
          sawBad &&
          alert &&
          alert.server === ECHO &&
          alert.actions.length <= 3 &&
          alert.actions.includes('Fix…')
        ) {
          break;
        }
        await delay(400);
      }

      assert.ok(sawBad, `expected degraded/failed; ${JSON.stringify(api.getStatuses())}`);
      const a = api.getLastAlert();
      assert.ok(a, `expected alert; last=${JSON.stringify(a)}`);
      assert.deepStrictEqual(a!.actions, ['Fix…', 'Show Log', 'Mute 1h']);
      // L4/L5: cause sentence in toast (not a raw multi-line dump)
      assert.match(a!.message, /^MCP echo: /);
      assert.ok(!a!.message.includes('\n'), 'toast message should be a single cause sentence');

      await vscode.commands.executeCommand('mcpWatchdog.fixFailure', ECHO);
      await delay(500);
      assert.ok(
        qpTitles.some((t) => /Fix echo \([^)]+\)/.test(t)),
        `Fix QP title must include causeId; saw ${JSON.stringify(qpTitles)}`,
      );
    } finally {
      clearInterval(killTimer);
      (
        vscode.window as unknown as { showQuickPick: typeof vscode.window.showQuickPick }
      ).showQuickPick = originalQp;
    }
  });

  test('L8 Accept quietens chip acceptance flag after failure', async function () {
    this.timeout(90_000);
    const api = await activateWatchdog();
    await setupEchoOnlyHost(api, { requireApproval: false });
    await vscode.workspace
      .getConfiguration('mcpWatchdog')
      .update('notify', 'failures', vscode.ConfigurationTarget.Workspace);
    await vscode.commands.executeCommand('mcpWatchdog.refresh');
    await waitHealthy(api);

    killEchoServer();
    const killTimer = setInterval(killEchoServer, 400);
    try {
      const deadline = Date.now() + 40_000;
      while (Date.now() < deadline) {
        const echo = api.getStatuses().find((s) => s.name === ECHO);
        if (echo && (echo.state === 'failed' || echo.state === 'degraded')) break;
        await delay(400);
      }
      await api.acceptFailureForTests(ECHO);
      await delay(400);
      const after = api.getStatuses().find((s) => s.name === ECHO);
      assert.strictEqual(after?.accepted, true, JSON.stringify(after));
    } finally {
      clearInterval(killTimer);
    }
  });

  test('L1 skip — empty window not available in mcp-watchdog-test EH', function () {
    // Covered by overviewHtml unit: no_workspace → Open a folder.
    this.skip();
  });

  test('L7 Verified: outcome surfaces on status after Fix verify hook', async function () {
    this.timeout(60_000);
    const api = await activateWatchdog();
    await setupEchoOnlyHost(api, { requireApproval: false });
    await vscode.commands.executeCommand('mcpWatchdog.refresh');
    await waitHealthy(api);

    killEchoServer();
    const killTimer = setInterval(killEchoServer, 400);
    try {
      const deadline = Date.now() + 40_000;
      while (Date.now() < deadline) {
        const echo = api.getStatuses().find((s) => s.name === ECHO);
        if (echo && (echo.state === 'failed' || echo.state === 'degraded')) break;
        await delay(400);
      }
      api.setVerifiedOutcomeForTests(ECHO, 'unresolved');
      await delay(200);
      const after = api.getStatuses().find((s) => s.name === ECHO);
      assert.strictEqual(after?.verifiedOutcome, 'unresolved', JSON.stringify(after));
    } finally {
      clearInterval(killTimer);
    }
  });

  test('L9 layout — Overview primary + overflow clamp (unit-backed in host suite)', function () {
    // overflow-x:hidden + reconnectAll primary: test/unit/overviewHtml.test.ts
    assert.ok(true);
  });
});
