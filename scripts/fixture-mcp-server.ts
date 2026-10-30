/**
 * Minimal Streamable HTTP MCP fixture for T0.
 * Session map; Origin validation; unknown session → 404.
 * Usage: npx tsx scripts/fixture-mcp-server.ts [port]
 */
import http from 'node:http';
import { randomBytes } from 'node:crypto';

const PORT = Number(process.argv[2] ?? process.env.PORT ?? 3921);
const sessions = new Map<string, { tools: unknown[] }>();

const TOOLS = [
  {
    name: 'echo',
    description: 'Echo',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
];

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && origin !== 'http://127.0.0.1' && origin !== `http://127.0.0.1:${PORT}`) {
    json(res, 403, { jsonrpc: '2.0', error: { code: -32000, message: 'Forbidden origin' }, id: null });
    return;
  }

  if (req.method === 'GET') {
    res.writeHead(405, { Allow: 'POST, DELETE' });
    res.end();
    return;
  }

  if (req.method === 'DELETE') {
    const sid = req.headers['mcp-session-id'];
    if (typeof sid === 'string') sessions.delete(sid);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end();
    return;
  }

  const accept = String(req.headers.accept ?? '');
  if (!accept.includes('text/event-stream') || !accept.includes('application/json')) {
    json(res, 406, { error: 'Accept must include application/json and text/event-stream' });
    return;
  }

  const raw = await readBody(req);
  let msg: { method?: string; id?: unknown; jsonrpc?: string };
  try {
    msg = JSON.parse(raw);
  } catch {
    json(res, 400, { error: 'bad json' });
    return;
  }

  const proto = req.headers['mcp-protocol-version'];
  if (proto && proto !== '2025-11-25' && proto !== '2025-03-26') {
    json(res, 400, { jsonrpc: '2.0', error: { code: -32000, message: 'Unsupported protocol' }, id: msg.id ?? null });
    return;
  }

  const sidHeader = req.headers['mcp-session-id'];
  const sid = typeof sidHeader === 'string' ? sidHeader : undefined;

  if (msg.method === 'notifications/initialized' || msg.method?.startsWith('notifications/')) {
    res.writeHead(202);
    res.end();
    return;
  }

  if (msg.method === 'initialize') {
    const id = randomBytes(16).toString('hex');
    sessions.set(id, { tools: TOOLS });
    const body = {
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        protocolVersion: '2025-11-25',
        capabilities: { tools: {} },
        serverInfo: { name: 'fixture-mcp', version: '0.1.0' },
      },
    };
    const data = JSON.stringify(body);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Mcp-Session-Id': id,
      'Content-Length': Buffer.byteLength(data),
    });
    res.end(data);
    return;
  }

  if (!sid) {
    json(res, 400, {
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Session ID required' },
      id: msg.id ?? null,
    });
    return;
  }
  if (!sessions.has(sid)) {
    json(res, 404, {
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Session not found' },
      id: msg.id ?? null,
    });
    return;
  }

  if (msg.method === 'ping') {
    json(res, 200, { jsonrpc: '2.0', id: msg.id, result: {} });
    return;
  }
  if (msg.method === 'tools/list') {
    json(res, 200, {
      jsonrpc: '2.0',
      id: msg.id,
      result: { tools: sessions.get(sid)!.tools },
    });
    return;
  }

  json(res, 200, {
    jsonrpc: '2.0',
    id: msg.id ?? null,
    error: { code: -32601, message: 'Method not found' },
  });
});

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`fixture-mcp listening on http://127.0.0.1:${PORT}/mcp\n`);
});
