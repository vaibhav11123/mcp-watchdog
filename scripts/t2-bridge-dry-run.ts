/**
 * T2: post names-only bridge incident to local mock API; reject secrets.
 */
import http from 'node:http';
import {
  BRIDGE_SCHEMA_VERSION,
  scrubBridgePayload,
} from '../packages/probe-core/src/index';

const PORT = 3922;
const stored: unknown[] = [];

async function main(): Promise<void> {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/v1/bridge/incidents') {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const raw = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const scrubbed = scrubBridgePayload(raw);
      if (!scrubbed.ok) {
        res.writeHead(scrubbed.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: scrubbed.error }));
        return;
      }
      stored.push({
        ide_state: scrubbed.payload.incident.stateTo,
        cloud_probe_state: 'healthy',
        incident: scrubbed.payload.incident,
      });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, dualTruth: stored.at(-1) }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((r) => server.listen(PORT, '127.0.0.1', () => r()));

  const good = {
    schemaVersion: BRIDGE_SCHEMA_VERSION,
    workspaceIdHash: 'hash',
    extensionVersion: '0.5.2',
    optIn: true,
    incident: {
      id: 't2',
      serverName: 'echo',
      transport: 'stdio' as const,
      commandName: 'node',
      stateFrom: 'healthy' as const,
      stateTo: 'failed' as const,
      envNames: ['API_KEY'],
      at: new Date().toISOString(),
    },
  };

  const okRes = await fetch(`http://127.0.0.1:${PORT}/v1/bridge/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(good),
  });
  if (okRes.status !== 201) {
    console.error('T2 FAIL good payload', await okRes.text());
    process.exit(1);
  }

  const badRes = await fetch(`http://127.0.0.1:${PORT}/v1/bridge/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...good,
      incident: { ...good.incident, env: { API_KEY: 'secret' } },
    }),
  });
  if (badRes.status !== 400) {
    console.error('T2 FAIL expected 400 for secrets', badRes.status);
    process.exit(1);
  }

  if (stored.length !== 1) {
    console.error('T2 FAIL dual-truth store');
    process.exit(1);
  }

  console.log('T2 PASS bridge dry-run + scrub reject');
  server.close();
}

main().catch((err) => {
  console.error('T2 FAIL', err);
  process.exit(1);
});
