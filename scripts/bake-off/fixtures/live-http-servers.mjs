#!/usr/bin/env node
/**
 * Minimal Streamable-HTTP stand-ins for bake-off S1–S3, S5, S6.
 * Not full MCP servers — return controlled status/body so clients surface auth/spawn failures.
 */
import http from 'node:http';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.BAKEOFF_HTTP_PORT || 18765);

const ROUTES = {
  '/s1': {
    status: 200,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32000, message: 'No token provided. Please provide a valid token.' },
    }),
  },
  '/s2': {
    status: 401,
    body: JSON.stringify({ error: 'Unauthorized' }),
    headers: { 'WWW-Authenticate': 'Bearer' },
  },
  '/s3': {
    status: 200,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32000, message: 'Your session has expired — run aws login' },
    }),
  },
  '/s5': {
    status: 200,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32000, message: 'No token provided' },
    }),
  },
  '/s6': {
    status: 200,
    // Bare OK page — not MCP; clients should fail protocol but HTTP is up
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        serverInfo: { name: 'bakeoff-healthy-stub', version: '0.0.0' },
      },
    }),
  },
};

const server = http.createServer((req, res) => {
  const path = (req.url || '/').split('?')[0];
  const route = ROUTES[path];
  if (!route) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
    return;
  }
  res.writeHead(route.status, {
    'Content-Type': 'application/json',
    ...(route.headers || {}),
  });
  res.end(route.body);
});

server.listen(PORT, '127.0.0.1', () => {
  const base = `http://127.0.0.1:${PORT}`;
  const meta = {
    port: PORT,
    base,
    routes: Object.fromEntries(Object.keys(ROUTES).map((p) => [p, `${base}${p}`])),
  };
  writeFileSync(join(__dirname, 'live-http-meta.json'), JSON.stringify(meta, null, 2));
  console.log(JSON.stringify(meta));
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
