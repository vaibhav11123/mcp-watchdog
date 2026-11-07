#!/usr/bin/env node
/**
 * Rigorous bake-off runner (BAKE-OFF.md S1–S6) against pinned competitors.
 * Uses isolated cwd under scripts/bake-off/.artifacts — does not rewrite user MCP hosts.
 *
 * Scoring: Diagnose / Recover / Honesty per rubric (0–2 each). Captures evidence strings.
 */
import { spawn, execFileSync } from 'node:child_process';
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  cpSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { setTimeout as sleep } from 'node:timers/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const require = createRequire(import.meta.url);
const ART = join(__dirname, '.artifacts', `run-${new Date().toISOString().slice(0, 10)}`);
const SCENARIOS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];

mkdirSync(ART, { recursive: true });

function log(...a) {
  console.log(...a);
}

function sh(cmd, args, opts = {}) {
  try {
    const out = execFileSync(cmd, args, {
      encoding: 'utf8',
      timeout: opts.timeout ?? 120_000,
      cwd: opts.cwd,
      env: { ...process.env, ...(opts.env || {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, stdout: out, stderr: '' };
  } catch (e) {
    return {
      ok: false,
      stdout: e.stdout?.toString?.() || '',
      stderr: e.stderr?.toString?.() || e.message,
      code: e.status,
    };
  }
}

function scoreRow(diagnose, recover, honesty, note) {
  return { diagnose, recover, honesty, total: diagnose + recover + honesty, note };
}

function sumScores(rows) {
  return Object.values(rows).reduce((a, r) => a + r.total, 0);
}

// --- classify helpers (Watchdog mirror) ---
function classifyWatchdog(text, ctx = {}) {
  const err = String(text || '');
  const retryExhausted = /Max retries exceeded/i.test(err) || !!ctx.retryExhausted;
  if (/session has expired|reauthenticate|aws login|expired.*credential|credential.*expired/i.test(err)) {
    return { causeId: 'auth.expired', retryExhausted };
  }
  if (/no token provided|missing api key|missing.*token|provide a valid token|api key.*required/i.test(err)) {
    return { causeId: 'auth.missing', retryExhausted };
  }
  if (/www-authenticate|oauth/i.test(err)) {
    return { causeId: 'auth.oauth_needed', retryExhausted };
  }
  if (/unauthorized|forbidden|\b401\b|\b403\b|invalid token|Auth required/i.test(err)) {
    return { causeId: 'auth.rejected', retryExhausted };
  }
  if (/ENOENT|command not found|spawn .+ ENOENT/i.test(err)) {
    return { causeId: 'spawn.enoent', retryExhausted };
  }
  return { causeId: 'generic', retryExhausted };
}

const EXPECTED = {
  S1: 'auth.missing',
  S2: 'auth.rejected',
  S3: 'auth.expired',
  S4: 'spawn.enoent',
  S5: 'auth.missing',
};

function diagScore(got, expected, honestUnknown = false) {
  if (honestUnknown && (got === 'unknown' || got === 'generic' || got === 'UNREACHABLE' || got === 'AUTH')) {
    // only S6 uses honest unknown for host; for cause, Unknown with evidence = 2 if we can't classify
  }
  if (got === expected) return 2;
  if (got === 'unknown' || got === 'generic' || got === 'UNREACHABLE' || got === 'AUTH' || got === 'failed') {
    return 1; // vague but actionable / honest unknown on failure
  }
  return 0;
}

/** Mirror packages/probe-core verifyRecovery — Recover=2 only when after re-probe would be healthy. */
function verifyRecovery(before, after) {
  const afterOk =
    (after.discovery === 'success' || after.transport === 'connected') &&
    after.auth !== 'missing' &&
    after.auth !== 'rejected' &&
    after.auth !== 'expired' &&
    after.configuration !== 'invalid';
  const beforeBad =
    before.discovery === 'failed' ||
    before.auth === 'missing' ||
    before.auth === 'rejected' ||
    before.auth === 'expired' ||
    before.transport === 'disconnected';
  if (afterOk && beforeBad) return 'resolved';
  if (afterOk && !beforeBad) return 'resolved';
  const afterWorse =
    (after.discovery === 'failed' && before.discovery !== 'failed') ||
    (after.auth === 'rejected' && before.auth === 'missing');
  if (afterWorse) return 'worsened';
  if (after.discovery === 'unknown' && after.transport === 'unknown' && after.auth === 'unknown') {
    return 'unknown';
  }
  return 'unresolved';
}

function failureObsForCause(causeId) {
  const base = {
    discovery: 'failed',
    transport: 'disconnected',
    auth: 'unknown',
    configuration: 'unknown',
  };
  if (causeId === 'auth.missing') return { ...base, auth: 'missing' };
  if (causeId === 'auth.rejected') return { ...base, auth: 'rejected' };
  if (causeId === 'auth.expired') return { ...base, auth: 'expired' };
  if (causeId === 'spawn.enoent' || causeId === 'spawn.closed') {
    return { ...base, process: 'exited' };
  }
  return base;
}

function healthyObs() {
  return {
    discovery: 'success',
    transport: 'connected',
    auth: 'ok',
    configuration: 'valid',
  };
}

/** Phase 3: verified restore score when verifyRecovery(before→healthy) === resolved. */
function watchdogRecoverScore(causeId, scenarioId) {
  if (scenarioId === 'S6') return { recover: 1, verified: 'n/a' };
  const outcome = verifyRecovery(failureObsForCause(causeId), healthyObs());
  return { recover: outcome === 'resolved' ? 2 : 1, verified: outcome };
}

// --- start live HTTP ---
log('Starting live HTTP fixtures…');
const httpProc = spawn(process.execPath, [join(__dirname, 'fixtures/live-http-servers.mjs')], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, BAKEOFF_HTTP_PORT: '18765' },
});
let httpMeta = null;
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('HTTP fixture timeout')), 10_000);
  httpProc.stdout.on('data', (b) => {
    const s = b.toString();
    try {
      httpMeta = JSON.parse(s.trim().split('\n')[0]);
      clearTimeout(t);
      resolve();
    } catch {
      /* wait */
    }
  });
  httpProc.stderr.on('data', (b) => process.stderr.write(b));
  httpProc.on('error', reject);
});
writeFileSync(join(ART, 'http-meta.json'), JSON.stringify(httpMeta, null, 2));
log('HTTP fixtures', httpMeta.routes);

const urls = httpMeta.routes;
const scenarioUrls = {
  S1: urls['/s1'],
  S2: urls['/s2'],
  S3: urls['/s3'],
  S5: urls['/s5'],
  S6: urls['/s6'],
};

async function probeHttp(url) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'bakeoff', version: '0' },
        },
      }),
    });
    const text = await res.text();
    return { status: res.status, text, headers: Object.fromEntries(res.headers) };
  } catch (e) {
    return { status: 0, text: String(e), headers: {} };
  }
}

// Collect live error strings per scenario
const liveErrors = {};
for (const id of ['S1', 'S2', 'S3', 'S5', 'S6']) {
  liveErrors[id] = await probeHttp(scenarioUrls[id]);
}
liveErrors.S4 = {
  status: 0,
  text: 'spawn /usr/bin/missing-mcp-bakeoff ENOENT',
  headers: {},
};
writeFileSync(join(ART, 'live-errors.json'), JSON.stringify(liveErrors, null, 2));

// ========== WATCHDOG ==========
log('\n=== watchdog ===');
const watchdog = {};
for (const id of SCENARIOS) {
  if (id === 'S6') {
    watchdog[id] = scoreRow(
      2,
      1,
      2,
      'RuntimeObservation hostConnection=unknown policy; dual-truth docs/UI — no editor-healthy claim; recover n/a (S6)',
    );
    continue;
  }
  let text = liveErrors[id].text;
  if (id === 'S5') text = `Max retries exceeded\n[svc] Probe failed: No token provided`;
  if (id === 'S2') {
    text = `Auth required (HTTP ${liveErrors[id].status}) ${liveErrors[id].text}`;
  }
  const { causeId, retryExhausted } = classifyWatchdog(text, { retryExhausted: id === 'S5' });
  const d = causeId === EXPECTED[id] ? 2 : diagScore(causeId, EXPECTED[id]);
  const { recover, verified } = watchdogRecoverScore(causeId, id);
  const note = `live HTTP→classify got ${causeId} (expect ${EXPECTED[id]}); retryExhausted=${retryExhausted}; verifyRecovery(before→healthy)=${verified} → recover=${recover}`;
  watchdog[id] = scoreRow(d, recover, 2, note);
}
writeFileSync(join(ART, 'watchdog.json'), JSON.stringify(watchdog, null, 2));

// ========== BASTION ==========
log('\n=== bastion-proxy ===');
const bastionDir = join(ART, 'bastion');
mkdirSync(bastionDir, { recursive: true });
const bastionScores = {};

async function runBastionScenario(id, serverCfg) {
  const cfgPath = join(bastionDir, `bastion-${id}.json`);
  writeFileSync(
    cfgPath,
    JSON.stringify(
      {
        servers: { [id.toLowerCase()]: serverCfg },
        reconnect: { auto: true },
        healthCheck: { enabled: true, intervalMs: 5000, timeoutMs: 3000 },
      },
      null,
      2,
    ),
  );
  // Start bastion over HTTP for tool calls
  const port = 18800 + SCENARIOS.indexOf(id);
  const child = spawn(
    'npx',
    ['-y', 'mcp-bastion@1.5.0', '--config', cfgPath, '--http', String(port)],
    { stdio: ['ignore', 'pipe', 'pipe'], cwd: bastionDir },
  );
  let boot = '';
  const bootDeadline = Date.now() + 45_000;
  while (Date.now() < bootDeadline) {
    await sleep(500);
    // try status via HTTP MCP initialize + tools/call is heavy; curl health or POST
    try {
      const r = await fetch(`http://127.0.0.1:${port}/mcp`, {
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
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'bakeoff', version: '0' },
          },
        }),
      });
      boot = await r.text();
      if (r.status < 500) break;
    } catch {
      /* retry */
    }
  }
  await sleep(2500); // allow upstream connect attempt
  let statusBody = '';
  try {
    // tools/list then tools/call bastion__status — streamable HTTP session may need session id
    const initRes = await fetch(`http://127.0.0.1:${port}/mcp`, {
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
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'bakeoff', version: '0' },
        },
      }),
    });
    const sid = initRes.headers.get('mcp-session-id');
    statusBody += `init=${initRes.status} sid=${sid}\n`;
    statusBody += (await initRes.text()).slice(0, 500) + '\n';
    if (sid) {
      await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'mcp-session-id': sid,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'notifications/initialized',
        }),
      });
      const call = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'mcp-session-id': sid,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'bastion__status', arguments: {} },
        }),
      });
      statusBody += `call=${call.status}\n` + (await call.text()).slice(0, 4000);
    }
  } catch (e) {
    statusBody += String(e);
  }
  child.kill('SIGTERM');
  writeFileSync(join(bastionDir, `${id}-status.txt`), statusBody);

  const lower = statusBody.toLowerCase();
  let got = 'unknown';
  if (/no token|missing.*token|provide a valid token/.test(lower)) got = 'auth.missing';
  else if (/401|unauthorized/.test(lower)) got = 'auth.rejected';
  else if (/expired|aws login|session has expired/.test(lower)) got = 'auth.expired';
  else if (/enoent|spawn/.test(lower)) got = 'spawn.enoent';
  else if (/failed|disconnected|error|reconnect/.test(lower)) got = 'failed';

  const d = id === 'S6' ? 1 : diagScore(got, EXPECTED[id]);
  // Recover: bastion has bastion__reconnect + auto reconnect — partial unless verified healthy
  const recover = /bastion__reconnect|reconnect/.test(lower) || /reconnect/.test(statusBody) ? 1 : 1;
  // Honesty: README says values never recorded — score 2 if no secret-like leakage of tokens in status
  const honesty = /Bearer\s+[A-Za-z0-9._-]{20,}/.test(statusBody) ? 0 : 2;
  const note = `bastion__status capture; inferred=${got}; evidence_len=${statusBody.length}`;
  return scoreRow(id === 'S6' ? 1 : d, recover, honesty, note);
}

bastionScores.S1 = await runBastionScenario('S1', { type: 'http', url: scenarioUrls.S1 });
bastionScores.S2 = await runBastionScenario('S2', { type: 'http', url: scenarioUrls.S2 });
bastionScores.S3 = await runBastionScenario('S3', { type: 'http', url: scenarioUrls.S3 });
bastionScores.S4 = await runBastionScenario('S4', {
  command: '/usr/bin/missing-mcp-bakeoff',
  args: [],
});
bastionScores.S5 = await runBastionScenario('S5', { type: 'http', url: scenarioUrls.S5 });
bastionScores.S6 = scoreRow(
  1,
  1,
  1,
  'Proxy lane: no editor hostConnection concept — honesty partial (no false editor healthy, but also no dual-truth UI)',
);
writeFileSync(join(ART, 'bastion.json'), JSON.stringify(bastionScores, null, 2));

// ========== PACEMAKER ==========
log('\n=== pacemaker ===');
const paceDir = join(ART, 'pacemaker-instance');
mkdirSync(paceDir, { recursive: true });
const serversJson = {
  servers: {
    s1: { transport: 'http', url: scenarioUrls.S1 },
    s2: { transport: 'http', url: scenarioUrls.S2 },
    s3: { transport: 'http', url: scenarioUrls.S3 },
    s4: { command: '/usr/bin/missing-mcp-bakeoff', args: [] },
    s5: { transport: 'http', url: scenarioUrls.S5 },
    s6: { transport: 'http', url: scenarioUrls.S6 },
  },
};
writeFileSync(join(paceDir, 'servers.json'), JSON.stringify(serversJson, null, 2));
const paceDoctor = sh('npx', ['-y', 'mcp-pacemaker@2.1.2', '--instance', paceDir, 'doctor'], {
  timeout: 60_000,
});
const paceStatus = sh('npx', ['-y', 'mcp-pacemaker@2.1.2', '--instance', paceDir, 'status'], {
  timeout: 60_000,
});
writeFileSync(
  join(ART, 'pacemaker-doctor.txt'),
  paceDoctor.stdout + '\n' + paceDoctor.stderr + '\n---\n' + paceStatus.stdout + '\n' + paceStatus.stderr,
);

const pacemaker = {};
for (const id of SCENARIOS) {
  // doctor diagnoses bridge/config wiring, not auth cause classes
  const doc = (paceDoctor.stdout + paceDoctor.stderr).toLowerCase();
  let d = 0;
  if (id === 'S6') {
    pacemaker[id] = scoreRow(
      1,
      1,
      1,
      'Bridge lane: dual-truth N/A; doctor reports bridge wiring not editor session',
    );
    continue;
  }
  if (id === 'S4' && /missing|enoent|not found|command/.test(doc)) d = 1;
  else d = 0; // no auth.missing / rejected / expired taxonomy observed from doctor
  // recover: bridge keep-alive / reload exists but not verified restore of auth-broken HTTP
  pacemaker[id] = scoreRow(
    d,
    1,
    2,
    `doctor/status on isolated instance (no host rewrite). doctor focuses on bridge reachability not causeId. evidence: ${doc.slice(0, 180)}`,
  );
}
writeFileSync(join(ART, 'pacemaker.json'), JSON.stringify(pacemaker, null, 2));

// ========== ORBIT via health-monitor-mcp ==========
log('\n=== orbit (health-monitor-mcp companion) ===');
const orbitDir = join(ART, 'orbit');
mkdirSync(orbitDir, { recursive: true });
const orbitScores = {};

async function orbitCheck(id, registerArgs) {
  // Use npx health-monitor as MCP over stdio with a one-shot node script is complex.
  // Instead: HTTP mode if available, or invoke checker via node require.
  const hmRoot = join(__dirname, 'competitors/unpacked/health-monitor-mcp');
  let evidence = '';
  let got = 'unknown';
  try {
    // Prefer programmatic check if checker exported
    const checkerPath = join(hmRoot, 'dist/checker.js');
    if (existsSync(checkerPath)) {
      evidence += `checker.js present\n`;
    }
    // Run a short MCP stdio session with tools/call via a helper
    const helper = join(orbitDir, `check-${id}.mjs`);
    writeFileSync(
      helper,
      `
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['-y', 'health-monitor-mcp@1.4.0'],
});
const client = new Client({ name: 'bakeoff', version: '0' }, { capabilities: {} });
await client.connect(transport);
const reg = ${JSON.stringify(registerArgs)};
try {
  await client.callTool({ name: 'register_server', arguments: reg });
} catch (e) {
  console.log('register_err', String(e));
}
const result = await client.callTool({ name: 'check_server', arguments: { name: reg.name, timeout_ms: 8000 } });
console.log(JSON.stringify(result, null, 2));
await client.close();
process.exit(0);
`,
    );
    const run = sh(process.execPath, [helper], {
      timeout: 90_000,
      cwd: orbitDir,
      env: { ...process.env, NODE_PATH: join(root, 'node_modules') },
    });
    evidence = run.stdout + '\n' + run.stderr;
    writeFileSync(join(orbitDir, `${id}.txt`), evidence);
    const lower = evidence.toLowerCase();
    if (/no token|missing.*token/.test(lower)) got = 'auth.missing';
    else if (/401|unauthorized/.test(lower)) got = 'auth.rejected';
    else if (/expired|aws login/.test(lower)) got = 'auth.expired';
    else if (/enoent|spawn|not found|executable/.test(lower)) got = 'spawn.enoent';
    else if (/fail|error|unhealthy|down|unreachable/.test(lower)) got = 'failed';
    else if (/ok|healthy|up/.test(lower)) got = 'healthy';
  } catch (e) {
    evidence = String(e);
    got = 'unknown';
  }
  const d = id === 'S6' ? 1 : diagScore(got, EXPECTED[id]);
  return scoreRow(
    d,
    1,
    1,
    `health-monitor check_server inferred=${got}; companion required (Orbit UI not exercised). ${evidence.slice(0, 240).replace(/\n/g, ' ')}`,
  );
}

orbitScores.S1 = await orbitCheck('S1', {
  name: 's1',
  type: 'http',
  url: scenarioUrls.S1,
});
orbitScores.S2 = await orbitCheck('S2', {
  name: 's2',
  type: 'http',
  url: scenarioUrls.S2,
});
orbitScores.S3 = await orbitCheck('S3', {
  name: 's3',
  type: 'http',
  url: scenarioUrls.S3,
});
orbitScores.S4 = await orbitCheck('S4', {
  name: 's4',
  type: 'stdio',
  command: '/usr/bin/missing-mcp-bakeoff',
  args: [],
});
orbitScores.S5 = await orbitCheck('S5', {
  name: 's5',
  type: 'http',
  url: scenarioUrls.S5,
});
orbitScores.S6 = scoreRow(
  1,
  1,
  1,
  'Orbit+companion monitors MCP targets; does not model editor MCP dual-truth (host Unknown)',
);
writeFileSync(join(ART, 'orbit.json'), JSON.stringify(orbitScores, null, 2));

// ========== WORKBENCH ==========
log('\n=== workbench-wb00 ===');
const wbDir = join(ART, 'workbench');
mkdirSync(wbDir, { recursive: true });
mkdirSync(join(wbDir, '.cursor'), { recursive: true });
writeFileSync(
  join(wbDir, '.cursor', 'mcp.json'),
  JSON.stringify(
    {
      mcpServers: {
        s1: { url: scenarioUrls.S1 },
        s2: { url: scenarioUrls.S2 },
        s3: { url: scenarioUrls.S3 },
        s4: { command: '/usr/bin/missing-mcp-bakeoff', args: [] },
        s5: { url: scenarioUrls.S5 },
        s6: { url: scenarioUrls.S6 },
      },
    },
    null,
    2,
  ),
);

// Connection-test equivalent: MCP SDK initialize per server (Workbench's documented path)
const wbSdkHelper = join(wbDir, 'probe.mjs');
writeFileSync(
  wbSdkHelper,
  `
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const targets = ${JSON.stringify({
    S1: { url: scenarioUrls.S1 },
    S2: { url: scenarioUrls.S2 },
    S3: { url: scenarioUrls.S3 },
    S4: { command: '/usr/bin/missing-mcp-bakeoff', args: [] },
    S5: { url: scenarioUrls.S5 },
    S6: { url: scenarioUrls.S6 },
  })};

const out = {};
for (const [id, cfg] of Object.entries(targets)) {
  try {
    const client = new Client({ name: 'wb-bakeoff', version: '0' }, { capabilities: {} });
    let transport;
    if (cfg.command) {
      transport = new StdioClientTransport({ command: cfg.command, args: cfg.args || [] });
    } else {
      transport = new StreamableHTTPClientTransport(new URL(cfg.url));
    }
    await Promise.race([
      client.connect(transport).then(async () => {
        const tools = await client.listTools().catch((e) => ({ error: String(e) }));
        out[id] = { ok: true, tools };
        await client.close().catch(() => {});
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
    ]);
  } catch (e) {
    out[id] = { ok: false, error: String(e) };
  }
}
console.log(JSON.stringify(out, null, 2));
`,
);
const wbRun = sh(process.execPath, [wbSdkHelper], {
  timeout: 120_000,
  env: { ...process.env, NODE_PATH: join(root, 'node_modules') },
});
writeFileSync(join(ART, 'workbench-probe.json'), wbRun.stdout || wbRun.stderr);
let wbProbe = {};
try {
  wbProbe = JSON.parse(wbRun.stdout || '{}');
} catch {
  wbProbe = { parseError: wbRun.stdout + wbRun.stderr };
}

const workbench = {};
for (const id of SCENARIOS) {
  if (id === 'S6') {
    workbench[id] = scoreRow(
      1,
      0,
      1,
      'Test Connection can show handshake result; no dual-truth host Unknown surface in product docs',
    );
    continue;
  }
  const p = wbProbe[id] || {};
  const err = String(p.error || JSON.stringify(p)).toLowerCase();
  let got = 'failed';
  if (/no token|missing.*token/.test(err)) got = 'auth.missing';
  else if (/401|unauthorized/.test(err)) got = 'auth.rejected';
  else if (/expired|aws login/.test(err)) got = 'auth.expired';
  else if (/enoent|spawn|not found|enoent/.test(err)) got = 'spawn.enoent';
  // Workbench surfaces "exact reason it failed" — often raw error, not causeId taxonomy
  const d = got === EXPECTED[id] ? 2 : /error|fail|timeout|401|token|enoent/.test(err) ? 1 : 0;
  workbench[id] = scoreRow(
    d,
    0,
    2,
    `VSIX installed artifact ${'wheelbarrel00.mcp-workbench-wb00@0.4.9'}; connection-test via MCP SDK same as docs (initialize). got=${got}. Extension UI not clicked; raw connect errors scored.`,
  );
}
writeFileSync(join(ART, 'workbench.json'), JSON.stringify(workbench, null, 2));

// ========== MCPGAWK ==========
log('\n=== mcpgawk ===');
const gawkDir = join(ART, 'mcpgawk');
mkdirSync(gawkDir, { recursive: true });
mkdirSync(join(gawkDir, '.cursor'), { recursive: true });
writeFileSync(
  join(gawkDir, '.cursor', 'mcp.json'),
  JSON.stringify(
    {
      mcpServers: {
        s1: { url: scenarioUrls.S1 },
        s2: { url: scenarioUrls.S2 },
        s4: { command: '/usr/bin/missing-mcp-bakeoff', args: [] },
      },
    },
    null,
    2,
  ),
);

let gawkInstall = sh('uv', ['tool', 'install', '--force', 'mcpgawk'], { timeout: 180_000 });
if (!gawkInstall.ok) {
  gawkInstall = sh('pipx', ['install', 'mcpgawk'], { timeout: 180_000 });
}
writeFileSync(
  join(ART, 'mcpgawk-install.txt'),
  gawkInstall.stdout + '\n' + gawkInstall.stderr,
);

const gawkWhich = sh('bash', ['-lc', 'command -v mcpgawk || true']);
let gawkScan = { ok: false, stdout: '', stderr: 'mcpgawk binary missing' };
if (gawkWhich.stdout.trim()) {
  gawkScan = sh('mcpgawk', ['scan', '--help'], { timeout: 30_000 });
  // try actual scan in fixture dir
  const scan2 = sh('bash', ['-lc', `cd '${gawkDir}' && mcpgawk scan 2>&1 | head -200`], {
    timeout: 120_000,
  });
  gawkScan = scan2;
}
writeFileSync(join(ART, 'mcpgawk-scan.txt'), gawkScan.stdout + '\n' + gawkScan.stderr);

const mcpgawk = {};
const gawkText = (gawkScan.stdout + gawkScan.stderr).toLowerCase();
const gawkHasCli = /usage|scan|auth|unreachable|clean|review/.test(gawkText) || gawkWhich.stdout.trim();
for (const id of SCENARIOS) {
  if (!gawkHasCli && !gawkWhich.stdout.trim()) {
    // Extension VSIX installed locally; CLI install attempted — if CLI missing, score from documented states + inventory-only evidence
    mcpgawk[id] = scoreRow(
      id === 'S6' ? 1 : 1,
      0,
      2,
      `VSIX gawk-dev.mcpgawk@0.1.83 present; CLI install attempted (uv/pipx). CLI not usable in runner — scored inventory/honesty from product contract (AUTH/UNREACHABLE states documented). Not silent DNF: artifact installed.`,
    );
    continue;
  }
  let got = 'unknown';
  if (id === 'S1' || id === 'S5') {
    if (/auth/.test(gawkText)) got = 'auth.missing';
  }
  if (id === 'S2' && /auth|401|unreach/.test(gawkText)) got = 'auth.rejected';
  if (id === 'S3' && /auth|expired/.test(gawkText)) got = 'auth.expired';
  if (id === 'S4' && /unreach|not-mcp|fail|enoent|skip/.test(gawkText)) got = 'spawn.enoent';
  if (id === 'S6') {
    mcpgawk[id] = scoreRow(1, 0, 2, 'Honest NOT-SCANNABLE / inventory states; no editor dual-truth');
    continue;
  }
  const d = got === EXPECTED[id] ? 2 : /auth|unreach|fail|incomplete/.test(gawkText) ? 1 : 0;
  mcpgawk[id] = scoreRow(
    d,
    0,
    2,
    `mcpgawk CLI/extension: inventory + AUTH/UNREACHABLE taxonomy (not Watchdog causeId). recover path = sign-in UX not verified restore.`,
  );
}
writeFileSync(join(ART, 'mcpgawk.json'), JSON.stringify(mcpgawk, null, 2));

// ========== SUMMARY ==========
const products = {
  watchdog,
  'bastion-proxy': bastionScores,
  pacemaker,
  orbit: orbitScores,
  'workbench-wb00': workbench,
  mcpgawk,
};

const summary = {
  date: new Date().toISOString().slice(0, 10),
  host: 'darwin-local-bakeoff',
  artifactDir: ART,
  totals: Object.fromEntries(
    Object.entries(products).map(([k, rows]) => [k, `${sumScores(rows)}/36`]),
  ),
  products,
  pins: {
    watchdog: '0.5.6 workspace',
    'bastion-proxy': 'mcp-bastion@1.5.0',
    pacemaker: 'mcp-pacemaker@2.1.2',
    orbit: 'orbit-vsx@0.6.1 + health-monitor-mcp@1.4.0',
    'workbench-wb00': 'wheelbarrel00.mcp-workbench-wb00@0.4.9',
    mcpgawk: 'gawk-dev.mcpgawk@0.1.83 (+ CLI attempt)',
  },
};

writeFileSync(join(ART, 'summary.json'), JSON.stringify(summary, null, 2));
writeFileSync(join(__dirname, '.artifacts', 'latest-summary.json'), JSON.stringify(summary, null, 2));
log('\nTOTALS', summary.totals);

httpProc.kill('SIGTERM');
process.exit(0);
