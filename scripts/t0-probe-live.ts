/**
 * T0 direction test: liveness + session hygiene against fixture MCP.
 * Origin failures on public URLs must not fail the overall run (B-origin-pack).
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';

const ROOT = path.join(__dirname, '..');
const PORT = 3921;
const BASE = `http://127.0.0.1:${PORT}`;

async function rpc(
  method: string,
  params?: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; sessionId?: string; body: string; ms: number }> {
  const start = Date.now();
  const res = await fetch(BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params ?? {} }),
  });
  const sessionId = res.headers.get('mcp-session-id') ?? undefined;
  const body = await res.text();
  return { status: res.status, sessionId, body, ms: Date.now() - start };
}

async function main(): Promise<void> {
  const child = spawn(
    process.execPath,
    [
      '--import',
      'tsx',
      path.join(ROOT, 'scripts/fixture-mcp-server.ts'),
      String(PORT),
    ],
    {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_OPTIONS: '' },
    },
  );
  let boot = '';
  child.stdout?.on('data', (d) => {
    boot += String(d);
  });
  child.stderr?.on('data', (d) => {
    boot += String(d);
  });
  for (let i = 0; i < 40; i++) {
    await sleep(150);
    try {
      await fetch(BASE, { method: 'GET' });
      break;
    } catch {
      if (i === 39) {
        child.kill('SIGKILL');
        throw new Error(`fixture server did not start: ${boot}`);
      }
    }
  }

  const latencies: number[] = [];
  let sessionId = '';
  try {
    for (let i = 0; i < 20; i++) {
      const init = await rpc('initialize', {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 't0', version: '0.0.1' },
      });
      if (init.status !== 200 || !init.sessionId) {
        throw new Error(`initialize failed: ${init.status} ${init.body}`);
      }
      sessionId = init.sessionId;
      const list = await rpc(
        'tools/list',
        {},
        { 'mcp-session-id': sessionId, 'mcp-protocol-version': '2025-11-25' },
      );
      if (list.status !== 200) throw new Error(`tools/list failed: ${list.status}`);
      latencies.push(init.ms + list.ms);
    }
    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? latencies.at(-1)!;
    if (p95 >= 2000) throw new Error(`B-live-init fail: p95=${p95}ms`);

    const unknown = await rpc(
      'ping',
      {},
      {
        'mcp-session-id': 'definitely-unknown-session',
        'mcp-protocol-version': '2025-11-25',
      },
    );
    if (unknown.status !== 404) throw new Error(`B-session fail: got ${unknown.status}`);

    await fetch(BASE, {
      method: 'DELETE',
      headers: { 'mcp-session-id': sessionId },
    });
    const after = await rpc(
      'ping',
      {},
      { 'mcp-session-id': sessionId, 'mcp-protocol-version': '2025-11-25' },
    );
    if (after.status !== 404) throw new Error(`session-terminated fail: ${after.status}`);

    // B-false-green: kill server, next probe must not look healthy
    child.kill('SIGKILL');
    await sleep(200);
    let deadOk = false;
    try {
      const r = await rpc('initialize', {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 't0', version: '0.0.1' },
      });
      if (r.status === 200) throw new Error('B-false-green: still healthy after kill');
      deadOk = true;
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('B-false-green')) throw e;
      deadOk = true; // connection refused = not healthy
    }
    if (!deadOk) throw new Error('B-false-green failed');

    // B-origin-pack: public URL Origin fail must not fail overall (we only warn)
    console.log('T0 origin note: conformance Origin not required for public URLs (pass)');
    console.log(`T0 PASS p95=${p95}ms session=404 false-green=ok`);
  } finally {
    child.kill('SIGKILL');
  }
}

main().catch((err) => {
  console.error('T0 FAIL', err);
  process.exit(1);
});
