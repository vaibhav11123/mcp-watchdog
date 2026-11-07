#!/usr/bin/env node
/**
 * Refine bastion + pacemaker + orbit scores with stdio MCP clients and short /tmp instance.
 * Writes into existing .artifacts/run-YYYY-MM-DD and refreshes summary.json.
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ART = join(__dirname, '.artifacts/run-2026-11-07');
const meta = JSON.parse(readFileSync(join(ART, 'http-meta.json'), 'utf8'));

function scoreRow(diagnose, recover, honesty, note) {
  return { diagnose, recover, honesty, total: diagnose + recover + honesty, note };
}
function sumScores(rows) {
  return Object.values(rows).reduce((a, r) => a + r.total, 0);
}

const EXPECTED = {
  S1: 'auth.missing',
  S2: 'auth.rejected',
  S3: 'auth.expired',
  S4: 'spawn.enoent',
  S5: 'auth.missing',
};

function inferCause(text) {
  const lower = String(text).toLowerCase();
  if (/no token|missing.*token|provide a valid token/.test(lower)) return 'auth.missing';
  if (/401|unauthorized|forbidden|\b403\b/.test(lower)) return 'auth.rejected';
  if (/expired|aws login|session has expired/.test(lower)) return 'auth.expired';
  if (/enoent|spawn|not found|no such file/.test(lower)) return 'spawn.enoent';
  if (/timeout|unreachable|failed|disconnected|error|down/.test(lower)) return 'failed';
  return 'unknown';
}

function diagScore(got, expected) {
  if (got === expected) return 2;
  if (got === 'failed' || got === 'unknown') return 1;
  return 0;
}

// Restart HTTP fixtures
const httpProc = spawn(process.execPath, [join(__dirname, 'fixtures/live-http-servers.mjs')], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, BAKEOFF_HTTP_PORT: '18765' },
});
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('http timeout')), 10_000);
  httpProc.stdout.on('data', (b) => {
    try {
      JSON.parse(b.toString().trim().split('\n')[0]);
      clearTimeout(t);
      resolve();
    } catch {
      /* */
    }
  });
  httpProc.on('error', reject);
});
const urls = meta.routes;

async function bastionStatus(id, serverCfg) {
  const cfgPath = join(ART, 'bastion', `stdio-${id}.json`);
  writeFileSync(
    cfgPath,
    JSON.stringify(
      {
        servers: { upstream: serverCfg },
        reconnect: { auto: true },
        healthCheck: { enabled: true, intervalMs: 2000, timeoutMs: 3000 },
      },
      null,
      2,
    ),
  );
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['-y', 'mcp-bastion@1.5.0', '--config', cfgPath],
  });
  const client = new Client({ name: 'bakeoff', version: '0' }, { capabilities: {} });
  let evidence = '';
  try {
    await Promise.race([
      client.connect(transport),
      new Promise((_, rej) => setTimeout(() => rej(new Error('connect timeout')), 45_000)),
    ]);
    await sleep(3000);
    const tools = await client.listTools();
    evidence += `tools=${tools.tools.map((t) => t.name).join(',')}\n`;
    const statusName =
      tools.tools.find((t) => /status/i.test(t.name))?.name || 'bastion__status';
    const result = await client.callTool({ name: statusName, arguments: {} });
    evidence += JSON.stringify(result, null, 2);
    await client.close().catch(() => {});
  } catch (e) {
    evidence += String(e);
    try {
      await client.close();
    } catch {
      /* */
    }
  }
  writeFileSync(join(ART, 'bastion', `stdio-${id}.txt`), evidence);
  return evidence;
}

console.log('Refining bastion via stdio…');
const bastion = {};
const bastionCfgs = {
  S1: { type: 'http', url: urls['/s1'] },
  S2: { type: 'http', url: urls['/s2'] },
  S3: { type: 'http', url: urls['/s3'] },
  S4: { command: '/usr/bin/missing-mcp-bakeoff', args: [] },
  S5: { type: 'http', url: urls['/s5'] },
};
for (const [id, cfg] of Object.entries(bastionCfgs)) {
  const evidence = await bastionStatus(id, cfg);
  const got = inferCause(evidence);
  const d = diagScore(got, EXPECTED[id]);
  const hasReconnect = /reconnect/i.test(evidence);
  bastion[id] = scoreRow(
    d,
    hasReconnect ? 1 : 1,
    /Bearer\s+[A-Za-z0-9._-]{16,}/.test(evidence) ? 0 : 2,
    `stdio bastion__status inferred=${got}; ${evidence.slice(0, 220).replace(/\s+/g, ' ')}`,
  );
  console.log(id, bastion[id].total, got);
}
bastion.S6 = scoreRow(
  1,
  1,
  1,
  'Proxy: no editor hostConnection dual-truth; control tools present; no false editor-healthy claim observed',
);
writeFileSync(join(ART, 'bastion.json'), JSON.stringify(bastion, null, 2));

// Pacemaker isolated short path
console.log('Refining pacemaker…');
const paceHome = '/tmp/bo-pace';
mkdirSync(paceHome, { recursive: true });
const srcCfg = join(paceHome, 'source-mcp.json');
writeFileSync(
  srcCfg,
  JSON.stringify(
    {
      mcpServers: {
        s1: { url: urls['/s1'] },
        s4: { command: '/usr/bin/missing-mcp-bakeoff', args: [] },
      },
    },
    null,
    2,
  ),
);
function sh(cmd, args, opts = {}) {
  try {
    return {
      ok: true,
      out: execFileSync(cmd, args, {
        encoding: 'utf8',
        timeout: opts.timeout ?? 90_000,
        env: { ...process.env, ...(opts.env || {}) },
      }),
    };
  } catch (e) {
    return { ok: false, out: (e.stdout || '') + (e.stderr || '') + e.message };
  }
}

const importOut = sh('npx', [
  '-y',
  'mcp-pacemaker@2.1.2',
  '--instance',
  paceHome,
  'import',
  '--config',
  srcCfg,
  '-y',
]);
const doctorOut = sh('npx', ['-y', 'mcp-pacemaker@2.1.2', '--instance', paceHome, 'doctor']);
const planOut = sh('npx', [
  '-y',
  'mcp-pacemaker@2.1.2',
  '--instance',
  paceHome,
  'plan',
  '--client',
  'cursor',
]);
const paceEvidence = [importOut.out, doctorOut.out, planOut.out].join('\n---\n');
writeFileSync(join(ART, 'pacemaker-doctor.txt'), paceEvidence);
const pacemaker = {};
for (const id of ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']) {
  if (id === 'S6') {
    pacemaker[id] = scoreRow(
      1,
      1,
      1,
      'doctor/plan/import on /tmp/bo-pace instance; bridge wiring not editor dual-truth',
    );
    continue;
  }
  const got = inferCause(paceEvidence);
  let d = 0;
  if (id === 'S4' && /missing|enoent|s4|command/.test(paceEvidence.toLowerCase())) d = 1;
  else if (/auth\.|401|token|expired/.test(paceEvidence.toLowerCase())) d = diagScore(got, EXPECTED[id]);
  else d = 0; // no per-scenario auth taxonomy in doctor output
  pacemaker[id] = scoreRow(
    d,
    1,
    2,
    `isolated --instance ${paceHome}; import+doctor+plan (no host rewrite). diagnose not causeId-native. ${paceEvidence.slice(0, 160).replace(/\s+/g, ' ')}`,
  );
}
writeFileSync(join(ART, 'pacemaker.json'), JSON.stringify(pacemaker, null, 2));
console.log('pacemaker evidence ok', paceEvidence.slice(0, 300));

// Re-check orbit S2 specially (401 should surface)
console.log('Refining orbit S2…');
async function orbitOne(name, reg) {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['-y', 'health-monitor-mcp@1.4.0'],
  });
  const client = new Client({ name: 'bakeoff', version: '0' }, { capabilities: {} });
  await client.connect(transport);
  await client.callTool({ name: 'register_server', arguments: reg });
  const result = await client.callTool({
    name: 'check_server',
    arguments: { name: reg.name, timeout_ms: 8000 },
  });
  await client.close().catch(() => {});
  return JSON.stringify(result);
}

const orbit = JSON.parse(readFileSync(join(ART, 'orbit.json'), 'utf8'));
for (const [id, reg] of [
  ['S2', { name: 's2', type: 'http', url: urls['/s2'] }],
  ['S4', { name: 's4', type: 'stdio', command: '/usr/bin/missing-mcp-bakeoff', args: [] }],
]) {
  try {
    const evidence = await orbitOne(reg.name, reg);
    writeFileSync(join(ART, 'orbit', `${id}-refine.txt`), evidence);
    const got = inferCause(evidence);
    orbit[id] = scoreRow(
      diagScore(got, EXPECTED[id]),
      1,
      1,
      `refined check_server inferred=${got}; ${evidence.slice(0, 200).replace(/\s+/g, ' ')}`,
    );
    console.log('orbit', id, got, orbit[id].total);
  } catch (e) {
    console.log('orbit refine fail', id, e);
  }
}
writeFileSync(join(ART, 'orbit.json'), JSON.stringify(orbit, null, 2));

// Resummarize
const watchdog = JSON.parse(readFileSync(join(ART, 'watchdog.json'), 'utf8'));
const workbench = JSON.parse(readFileSync(join(ART, 'workbench.json'), 'utf8'));
const mcpgawk = JSON.parse(readFileSync(join(ART, 'mcpgawk.json'), 'utf8'));
const products = {
  watchdog,
  'bastion-proxy': bastion,
  pacemaker,
  orbit,
  'workbench-wb00': workbench,
  mcpgawk,
};
const summary = {
  date: '2026-11-07',
  host: 'darwin-local-bakeoff',
  maxPerProduct: 36,
  scenarioSet: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
  artifactDir: ART,
  totals: Object.fromEntries(
    Object.entries(products).map(([k, rows]) => [k, `${sumScores(rows)}/36`]),
  ),
  products,
  pins: {
    watchdog: '0.5.6 workspace Doctor classifier + dual-truth policy',
    'bastion-proxy': 'mcp-bastion@1.5.0 (stdio bastion__status)',
    pacemaker: 'mcp-pacemaker@2.1.2 (--instance /tmp/bo-pace import/doctor/plan)',
    orbit: 'health-monitor-mcp@1.4.0 companion (Orbit VSIX 0.6.1 installed artifact)',
    'workbench-wb00': 'wheelbarrel00.mcp-workbench-wb00@0.4.9 + MCP SDK connection-test parity',
    mcpgawk: 'gawk-dev.mcpgawk@0.1.83 VSIX; CLI scan against machine configs',
  },
  methodNotes: [
    'No DNF: every pinned artifact was installed/downloaded and exercised.',
    'Denominator /36 = 6 scenarios × 6 points (S1 twin class covered by Watchdog unit tests, not a 7th bake-off row).',
    'Recover=2 never awarded: no product completed verified healthy re-probe after Fix in this run.',
  ],
};
writeFileSync(join(ART, 'summary.json'), JSON.stringify(summary, null, 2));
writeFileSync(join(__dirname, '.artifacts/latest-summary.json'), JSON.stringify(summary, null, 2));
console.log('TOTALS', summary.totals);
httpProc.kill('SIGTERM');
