#!/usr/bin/env node
/**
 * Streamable-HTTP MCP hang fixture for live transport.timeout checks.
 * Completes initialize, then never answers subsequent JSON-RPC requests (ping).
 */
import http from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.HANG_HTTP_PORT || 18771);
const HOST = process.env.HANG_HTTP_HOST || '127.0.0.1';

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseMessages(raw) {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function initializeResult(id) {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      serverInfo: { name: 'hang-http-fixture', version: '0.0.1' },
    },
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type, mcp-session-id',
      'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
    });
    res.end();
    return;
  }

  const sessionHeader = req.headers['mcp-session-id'];
  const sessionId = typeof sessionHeader === 'string' && sessionHeader ? sessionHeader : randomUUID();

  if (req.method === 'GET') {
    // Keep SSE/stream open forever — never write events.
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'mcp-session-id': sessionId,
      'Access-Control-Allow-Origin': '*',
    });
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405).end();
    return;
  }

  const raw = await readBody(req);
  const messages = parseMessages(raw);
  const init = messages.find((m) => m && m.method === 'initialize');

  if (init) {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'mcp-session-id': sessionId,
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(initializeResult(init.id)));
    return;
  }

  // ACK notifications quickly so connect can finish.
  const onlyNotifications =
    messages.length > 0 && messages.every((m) => m && typeof m.method === 'string' && m.id === undefined);
  if (onlyNotifications) {
    res.writeHead(202, {
      'mcp-session-id': sessionId,
      'Access-Control-Allow-Origin': '*',
    });
    res.end();
    return;
  }

  // Requests with an id (ping, tools/list, …): hang — no headers/body.
  // Client ping({ timeout }) should surface MCP -32001 Request timed out.
});

server.listen(PORT, HOST, () => {
  console.log(JSON.stringify({ ok: true, url: `http://${HOST}:${PORT}/mcp`, port: PORT }));
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
