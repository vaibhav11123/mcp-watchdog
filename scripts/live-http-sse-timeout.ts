/**
 * Live Cut A gate: hang HTTP + SSE fixtures → MCP Request timed out → transport.timeout.
 * Uses the same Client + transports as the extension (not string-only unit fixtures).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { causeSentence, diagnose } from '../packages/probe-core/src/diagnostics/index';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PING_TIMEOUT_MS = Number(process.env.PING_TIMEOUT_MS || 1500);
const HTTP_PORT = Number(process.env.HANG_HTTP_PORT || 18771);
const SSE_PORT = Number(process.env.HANG_SSE_PORT || 18772);

async function freePort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = createServer();
    s.once('error', () => resolve(false));
    s.listen(port, '127.0.0.1', () => s.close(() => resolve(true)));
  });
}

function startFixture(
  script: string,
  env: Record<string, string>,
): { child: ChildProcess; readyPromise: Promise<{ ok: boolean; url: string; port: number }> } {
  const child = spawn(process.execPath, [script], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const readyPromise = new Promise<{ ok: boolean; url: string; port: number }>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`fixture start timeout: ${script}`)), 8000);
    const onData = (buf: Buffer) => {
      const text = buf.toString('utf8');
      const line = text
        .trim()
        .split('\n')
        .find((l) => l.includes('"ok"'));
      if (line) {
        clearTimeout(t);
        child.stdout?.off('data', onData);
        resolve(JSON.parse(line) as { ok: boolean; url: string; port: number });
      }
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', (b: Buffer) => process.stderr.write(b));
    child.on('exit', (code) => {
      clearTimeout(t);
      reject(new Error(`${script} exited early code=${code}`));
    });
  });
  return { child, readyPromise };
}

async function probeHttp(url: string): Promise<string> {
  const client = new Client({ name: 'live-timeout-http', version: '0.0.0' }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(url));
  await client.connect(transport);
  try {
    await client.ping({ timeout: PING_TIMEOUT_MS });
    throw new Error('HTTP hang fixture unexpectedly answered ping');
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  } finally {
    try {
      await client.close();
    } catch {
      /* ignore */
    }
  }
}

async function probeSse(url: string): Promise<string> {
  const client = new Client({ name: 'live-timeout-sse', version: '0.0.0' }, { capabilities: {} });
  const transport = new SSEClientTransport(new URL(url));
  await client.connect(transport);
  try {
    await client.ping({ timeout: PING_TIMEOUT_MS });
    throw new Error('SSE hang fixture unexpectedly answered ping');
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  } finally {
    try {
      await client.close();
    } catch {
      /* ignore */
    }
  }
}

function assertTimeoutCause(transport: string, serverName: string, lastError: string) {
  if (!/Request timed out/i.test(lastError)) {
    throw new Error(`${transport}: expected Request timed out, got: ${lastError}`);
  }
  const d = diagnose({
    serverName,
    lastError: 'Max retries exceeded',
    lastProbeError: lastError,
    wave2Actions: true,
  });
  if (d.causeId !== 'transport.timeout') {
    throw new Error(`${transport}: expected transport.timeout, got ${d.causeId} for ${lastError}`);
  }
  const sentence = causeSentence(d.causeId);
  const expect = "Server didn't answer in time - check its log and configuration.";
  if (sentence !== expect) {
    throw new Error(`${transport}: unexpected sentence ${sentence}`);
  }
  return {
    transport,
    serverName,
    lastError,
    causeId: d.causeId,
    sentence,
    actions: d.actions.map((a) => ({ id: a.id, label: a.label })),
  };
}

async function main(): Promise<void> {
  if (!(await freePort(HTTP_PORT)) || !(await freePort(SSE_PORT))) {
    throw new Error(`ports ${HTTP_PORT}/${SSE_PORT} busy`);
  }

  const httpFix = startFixture(join(root, 'mcp-watchdog-test/fixtures/hang-http-server.mjs'), {
    HANG_HTTP_PORT: String(HTTP_PORT),
  });
  const sseFix = startFixture(join(root, 'mcp-watchdog-test/fixtures/hang-sse-server.mjs'), {
    HANG_SSE_PORT: String(SSE_PORT),
  });

  try {
    const httpMeta = await httpFix.readyPromise;
    const sseMeta = await sseFix.readyPromise;
    await sleep(200);

    const httpErr = await probeHttp(httpMeta.url);
    const sseErr = await probeSse(sseMeta.url);

    const results = [
      assertTimeoutCause('http', 'hang-http', httpErr),
      assertTimeoutCause('sse', 'hang-sse', sseErr),
    ];

    console.log(
      JSON.stringify(
        {
          ok: true,
          pingTimeoutMs: PING_TIMEOUT_MS,
          commitHint: 'live Client+transport hang fixtures',
          results,
        },
        null,
        2,
      ),
    );
  } finally {
    httpFix.child.kill('SIGTERM');
    sseFix.child.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
