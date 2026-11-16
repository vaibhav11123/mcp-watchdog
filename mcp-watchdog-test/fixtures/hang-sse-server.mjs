#!/usr/bin/env node
/**
 * Legacy SSE MCP hang fixture for live transport.timeout checks.
 * Opens SSE + endpoint event, answers initialize on POST, then hangs.
 */
import http from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.HANG_SSE_PORT || 18772);
const HOST = process.env.HANG_SSE_HOST || '127.0.0.1';

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
      serverInfo: { name: 'hang-sse-fixture', version: '0.0.1' },
    },
  };
}

/** @type {Map<string, import('node:http').ServerResponse>} */
const streams = new Map();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/sse') {
    const sessionId = randomUUID();
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    const endpoint = `/message?sessionId=${sessionId}`;
    res.write(`event: endpoint\ndata: ${endpoint}\n\n`);
    streams.set(sessionId, res);
    req.on('close', () => streams.delete(sessionId));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/message') {
    const sessionId = url.searchParams.get('sessionId') || '';
    const stream = streams.get(sessionId);
    const raw = await readBody(req);
    const messages = parseMessages(raw);
    const init = messages.find((m) => m && m.method === 'initialize');

    // SSE clients expect 202 Accepted on the POST; responses ride the SSE stream.
    res.writeHead(202).end();

    if (init && stream && !stream.writableEnded) {
      stream.write(`event: message\ndata: ${JSON.stringify(initializeResult(init.id))}\n\n`);
      return;
    }

    const onlyNotifications =
      messages.length > 0 &&
      messages.every((m) => m && typeof m.method === 'string' && m.id === undefined);
    if (onlyNotifications) {
      // No SSE payload required for notifications.
      return;
    }

    // Later requests with an id (ping): hang — never write a response event.
    return;
  }

  res.writeHead(404).end('not found');
});

server.listen(PORT, HOST, () => {
  console.log(JSON.stringify({ ok: true, url: `http://${HOST}:${PORT}/sse`, port: PORT }));
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
