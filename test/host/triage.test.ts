import * as assert from 'assert';
import { spawn, type ChildProcess, execSync } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import * as vscode from 'vscode';
import { activateWatchdog, delay, ECHO, setupEchoOnlyHost } from './helpers';

function killEchoServer(): void {
  try {
    execSync("pkill -9 -f 'echo-server.js'", { stdio: 'ignore' });
  } catch {
    // already dead
  }
}

async function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
          res.resume();
          if (res.statusCode && res.statusCode < 500) {
            resolve();
          } else {
            reject(new Error('bad status'));
          }
        });
        req.on('error', reject);
        req.setTimeout(500, () => {
          req.destroy();
          reject(new Error('timeout'));
        });
      });
      return;
    } catch {
      await delay(200);
    }
  }
  throw new Error(`Cloud not healthy on :${port} within ${timeoutMs}ms`);
}

async function getBridgeIncidents(port: number): Promise<Array<Record<string, unknown>>> {
  const body = await new Promise<string>((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${port}/v1/bridge/incidents`, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      })
      .on('error', reject);
  });
  return JSON.parse(body) as Array<Record<string, unknown>>;
}

function startLocalCloud(port: number): ChildProcess {
  const repoRoot = path.resolve(vscode.workspace.workspaceFolders![0].uri.fsPath, '..');
  const serverTs = path.join(repoRoot, 'packages', 'cloud', 'src', 'server.ts');
  return spawn('npx', ['--yes', 'tsx', serverTs], {
    cwd: path.join(repoRoot, 'packages', 'cloud'),
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore',
  });
}

suite('MCP Watchdog triage (host)', () => {
  test('acceptFailure excludes failed echo from chip-facing statuses after kill', async function () {
    this.timeout(90_000);
    const api = await activateWatchdog();
    await setupEchoOnlyHost(api, { requireApproval: false });
    await vscode.workspace
      .getConfiguration('mcpWatchdog')
      .update('notify', 'failures', vscode.ConfigurationTarget.Workspace);
    await vscode.commands.executeCommand('mcpWatchdog.refresh');

    const healthyDeadline = Date.now() + 45_000;
    while (Date.now() < healthyDeadline) {
      if (api.getStatuses().some((s) => s.name === ECHO && s.state === 'healthy')) break;
      await delay(500);
    }
    assert.ok(api.getStatuses().some((s) => s.name === ECHO && s.state === 'healthy'));

    killEchoServer();
    const killTimer = setInterval(killEchoServer, 400);
    try {
      const failDeadline = Date.now() + 40_000;
      while (Date.now() < failDeadline) {
        const echo = api.getStatuses().find((s) => s.name === ECHO);
        if (echo && (echo.state === 'failed' || echo.state === 'degraded')) break;
        await delay(400);
      }
      const before = api.getStatuses().find((s) => s.name === ECHO);
      assert.ok(before && (before.state === 'failed' || before.state === 'degraded'));

      await api.acceptFailureForTests(ECHO);
      await delay(500);
      const after = api.getStatuses().find((s) => s.name === ECHO);
      assert.ok(after?.accepted === true, `expected accepted; got ${JSON.stringify(after)}`);

      await vscode.commands.executeCommand('mcpWatchdog.clearAcceptance', ECHO);
      await delay(300);
      const cleared = api.getStatuses().find((s) => s.name === ECHO);
      assert.ok(!cleared?.accepted, `expected unaccepted; got ${JSON.stringify(cleared)}`);
    } finally {
      clearInterval(killTimer);
    }
  });

  test('removeServerForTests deletes key from workspace .cursor/mcp.json', async function () {
    this.timeout(60_000);
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder, 'workspace folder required');
    const mcpPath = path.join(folder.uri.fsPath, '.cursor', 'mcp.json');
    const dir = path.dirname(mcpPath);
    fs.mkdirSync(dir, { recursive: true });
    const name = `triage-rm-${Date.now()}`;
    const payload = {
      mcpServers: {
        [name]: {
          command: 'node',
          args: ['-e', 'process.exit(1)'],
        },
      },
    };
    fs.writeFileSync(mcpPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');

    const prev = process.env.MCP_WATCHDOG_HOST_AUTOCONFIRM;
    process.env.MCP_WATCHDOG_HOST_AUTOCONFIRM = '1';
    try {
      const api = await activateWatchdog();
      await vscode.workspace
        .getConfiguration('mcpWatchdog')
        .update('requireApproval', false, vscode.ConfigurationTarget.Workspace);
      await vscode.commands.executeCommand('mcpWatchdog.refresh');
      await delay(1500);

      assert.ok(
        api.getStatuses().some((s) => s.name === name) ||
          fs.readFileSync(mcpPath, 'utf8').includes(name),
        'server should be present in config before remove',
      );

      await api.removeServerForTests(name);
      await delay(500);

      const afterRaw = fs.readFileSync(mcpPath, 'utf8');
      const after = JSON.parse(afterRaw) as { mcpServers?: Record<string, unknown> };
      assert.ok(
        !after.mcpServers || !(name in after.mcpServers),
        `expected ${name} removed; got ${afterRaw}`,
      );
    } finally {
      if (prev === undefined) delete process.env.MCP_WATCHDOG_HOST_AUTOCONFIRM;
      else process.env.MCP_WATCHDOG_HOST_AUTOCONFIRM = prev;
      // Leave a clean empty cursor layer for later suites.
      fs.writeFileSync(mcpPath, '{\n  "mcpServers": {}\n}\n', 'utf8');
    }
  });

  test('cloudBridge posts fail then accepted to local Cloud', async function () {
    this.timeout(120_000);
    const port = 18787 + Math.floor(Math.random() * 1000);
    const cloud = startLocalCloud(port);
    try {
      await waitForPort(port, 30_000);

      const api = await activateWatchdog();
      await setupEchoOnlyHost(api, { requireApproval: false });
      const cfg = vscode.workspace.getConfiguration('mcpWatchdog');
      await cfg.update('cloudBridge.enabled', true, vscode.ConfigurationTarget.Workspace);
      await cfg.update(
        'cloudBridge.url',
        `http://127.0.0.1:${port}`,
        vscode.ConfigurationTarget.Workspace,
      );
      await cfg.update('notify', 'failures', vscode.ConfigurationTarget.Workspace);
      await vscode.commands.executeCommand('mcpWatchdog.refresh');

      const healthyDeadline = Date.now() + 45_000;
      while (Date.now() < healthyDeadline) {
        if (api.getStatuses().some((s) => s.name === ECHO && s.state === 'healthy')) break;
        await delay(500);
      }
      assert.ok(api.getStatuses().some((s) => s.name === ECHO && s.state === 'healthy'));

      killEchoServer();
      const killTimer = setInterval(killEchoServer, 400);
      try {
        const failDeadline = Date.now() + 40_000;
        while (Date.now() < failDeadline) {
          const echo = api.getStatuses().find((s) => s.name === ECHO);
          if (echo && (echo.state === 'failed' || echo.state === 'degraded')) break;
          await delay(400);
        }
        assert.ok(
          api
            .getStatuses()
            .some((s) => s.name === ECHO && (s.state === 'failed' || s.state === 'degraded')),
        );

        const failSeenDeadline = Date.now() + 15_000;
        let sawFail = false;
        while (Date.now() < failSeenDeadline) {
          const incidents = await getBridgeIncidents(port);
          if (incidents.some((i) => i.serverName === ECHO)) {
            sawFail = true;
            break;
          }
          await delay(400);
        }
        assert.ok(sawFail, 'expected bridge incident for echo failure');

        await api.acceptFailureForTests(ECHO);
        const acceptDeadline = Date.now() + 10_000;
        let sawAccepted = false;
        while (Date.now() < acceptDeadline) {
          const incidents = await getBridgeIncidents(port);
          if (incidents.some((i) => i.serverName === ECHO && i.accepted === true)) {
            sawAccepted = true;
            break;
          }
          await delay(300);
        }
        assert.ok(sawAccepted, 'expected bridge incident with accepted: true');
      } finally {
        clearInterval(killTimer);
      }
    } finally {
      cloud.kill('SIGTERM');
      const cfg = vscode.workspace.getConfiguration('mcpWatchdog');
      await cfg.update('cloudBridge.enabled', false, vscode.ConfigurationTarget.Workspace);
      await cfg.update('cloudBridge.url', '', vscode.ConfigurationTarget.Workspace);
    }
  });
});
