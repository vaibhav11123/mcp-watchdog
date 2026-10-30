/**
 * Watchdog Cloud MVP — monitor registry, poll, bridge ingest, policy audit.
 * In-memory by default; see migrations/ for Postgres ERD.
 */
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  diffTools,
  scrubBridgePayload,
  toolsSnapshotHash,
  type ToolDefinition,
} from '../../probe-core/src/index';
import { evaluatePolicy, type PolicyRule } from './policy/evaluate';
import {
  appendAudit,
  auditLog,
  bridgeIncidents,
  diffs,
  servers,
  type WatchedServer,
} from './store';

const PORT = Number(process.env.PORT ?? 8787);
const SLACK = process.env.SLACK_WEBHOOK_URL;

const defaultPolicy: PolicyRule = {
  id: 'default',
  denyUnpinnedNpxY: true,
  allowedCommands: ['node', 'npx', 'uvx', 'docker'],
};

async function slack(text: string): Promise<void> {
  if (!SLACK) return;
  await fetch(SLACK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  }).catch(() => {});
}

async function probeServer(s: WatchedServer): Promise<void> {
  try {
    const initRes = await fetch(s.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'watchdog-cloud', version: '0.1.0' },
        },
      }),
    });
    if (!initRes.ok) {
      s.lastState = 'failed';
      s.lastError = `initialize HTTP ${initRes.status}`;
      await slack(`Watchdog: ${s.name} down (initialize ${initRes.status})`);
      return;
    }
    const sid = initRes.headers.get('mcp-session-id');
    const listRes = await fetch(s.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(sid ? { 'mcp-session-id': sid } : {}),
        'mcp-protocol-version': '2025-11-25',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    });
    const body = (await listRes.json()) as { result?: { tools?: ToolDefinition[] } };
    const tools = body.result?.tools ?? [];
    const hash = toolsSnapshotHash(tools);
    const extended = s as WatchedServer & { lastTools?: ToolDefinition[] };
    if (s.lastHash && s.lastHash !== hash) {
      const real = diffTools(extended.lastTools ?? [], tools);
      const severity = real.breaking.length
        ? 'breaking'
        : real.info.length
          ? 'info'
          : 'patch';
      diffs.push({
        serverId: s.id,
        severity,
        detail: JSON.stringify(real.changes.slice(0, 20)),
        at: new Date().toISOString(),
      });
      if (severity === 'breaking') {
        await slack(`Watchdog: ${s.name} BREAKING schema drift`);
      }
    }
    extended.lastTools = tools;
    s.lastHash = hash;
    s.lastState = 'healthy';
    s.lastError = undefined;
  } catch (e) {
    s.lastState = 'failed';
    s.lastError = e instanceof Error ? e.message : String(e);
    await slack(`Watchdog: ${s.name} probe error`);
  }
}

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function send(res: http.ServerResponse, status: number, body: unknown): void {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'string' ? 'text/html; charset=utf-8' : 'application/json',
  });
  res.end(data);
}

const dashboard = readFileSync(join(__dirname, 'public', 'index.html'), 'utf8');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/') {
    send(res, 200, dashboard);
    return;
  }
  if (req.method === 'GET' && url.pathname === '/v1/servers') {
    send(res, 200, [...servers.values()]);
    return;
  }
  if (req.method === 'POST' && url.pathname === '/v1/servers') {
    const body = (await readJson(req)) as { name?: string; url?: string };
    if (!body.name || !body.url) {
      send(res, 400, { error: 'name and url required' });
      return;
    }
    const id = randomUUID();
    servers.set(id, { id, name: body.name, url: body.url });
    appendAudit('server.create', body.name);
    send(res, 201, servers.get(id));
    return;
  }
  if (req.method === 'POST' && url.pathname.startsWith('/v1/servers/') && url.pathname.endsWith('/poll-now')) {
    const id = url.pathname.split('/')[3];
    const s = id ? servers.get(id) : undefined;
    if (!s) {
      send(res, 404, { error: 'not found' });
      return;
    }
    await probeServer(s);
    send(res, 200, s);
    return;
  }
  if (req.method === 'POST' && url.pathname === '/v1/bridge/incidents') {
    const raw = await readJson(req);
    const scrubbed = scrubBridgePayload(raw);
    if (!scrubbed.ok) {
      send(res, scrubbed.status, { error: scrubbed.error });
      return;
    }
    const p = scrubbed.payload;
    const matched = [...servers.values()].find((s) => s.name === p.incident.serverName);
    bridgeIncidents.push({
      id: p.incident.id,
      workspaceIdHash: p.workspaceIdHash,
      serverName: p.incident.serverName,
      ide_state: p.incident.stateTo,
      cloud_probe_state: matched?.lastState ?? null,
      at: p.incident.at,
    });
    appendAudit('bridge.incident', p.incident.serverName);
    send(res, 201, { ok: true, dualTruth: bridgeIncidents.at(-1) });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/v1/bridge/incidents') {
    send(res, 200, bridgeIncidents);
    return;
  }
  if (req.method === 'GET' && url.pathname === '/v1/diffs') {
    send(res, 200, diffs);
    return;
  }
  if (req.method === 'POST' && url.pathname === '/v1/policy/evaluate') {
    const body = (await readJson(req)) as {
      command?: string;
      args?: string[];
      urlHost?: string;
    };
    const decision = evaluatePolicy(defaultPolicy, body);
    appendAudit(decision.allow ? 'policy.allow' : 'policy.deny', decision.reason);
    send(res, 200, decision);
    return;
  }
  if (req.method === 'GET' && url.pathname === '/v1/policy/audit') {
    send(res, 200, auditLog.slice(-100));
    return;
  }

  send(res, 404, { error: 'not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Watchdog Cloud on http://127.0.0.1:${PORT}`);
});
