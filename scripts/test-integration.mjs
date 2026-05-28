/**
 * Headless integration tests (no VS Code host).
 * - Config: VS Code + Cursor JSON shapes, merge, ${workspaceFolder}
 * - Runtime: connect + ping like ServerMonitor for fixture servers
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const FIXTURE_ROOT = path.join(REPO_ROOT, 'mcp-watchdog-test');

const WORKSPACE_FOLDER = /\$\{workspaceFolder\}/g;

function expandWorkspaceVars(value, workspaceRoot) {
  if (typeof value === 'string') return value.replace(WORKSPACE_FOLDER, workspaceRoot);
  if (Array.isArray(value)) return value.map((item) => expandWorkspaceVars(item, workspaceRoot));
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) out[key] = expandWorkspaceVars(value[key], workspaceRoot);
    return out;
  }
  return value;
}

function extractServersBlock(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const block = parsed.servers ?? parsed.mcpServers;
  if (!block || typeof block !== 'object' || Array.isArray(block)) return null;
  return block;
}

function normalizeServerEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  if (entry.type === 'http' || (typeof entry.url === 'string' && entry.url)) {
    return entry.url ? { type: 'http', url: entry.url, headers: entry.headers } : null;
  }
  if (typeof entry.command !== 'string' || !entry.command) return null;
  return {
    type: 'stdio',
    command: entry.command,
    args: Array.isArray(entry.args) ? entry.args : undefined,
    env: entry.env,
    cwd: entry.cwd,
  };
}

function readConfigFile(filePath, workspaceRoot) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const block = extractServersBlock(parsed);
    if (!block) return null;
    const servers = {};
    for (const key of Object.keys(block)) {
      const n = normalizeServerEntry(block[key]);
      if (n) servers[key] = expandWorkspaceVars(n, workspaceRoot);
    }
    return servers;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

function loadMergedConfig(workspaceRoot) {
  const merged = {};
  const globalPath = path.join(os.homedir(), '.cursor', 'mcp.json');
  for (const p of [
    globalPath,
    path.join(workspaceRoot, '.vscode', 'mcp.json'),
    path.join(workspaceRoot, '.cursor', 'mcp.json'),
  ]) {
    const layer = readConfigFile(p, workspaceRoot);
    if (layer) Object.assign(merged, layer);
  }
  return merged;
}

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function assertConfigTests() {
  const ws = FIXTURE_ROOT;
  const fromVscode = readConfigFile(path.join(ws, '.vscode', 'mcp.json'), ws);
  assert(fromVscode?.memory?.command === 'npx', 'vscode mcp.json loads memory server');
  assert(
    fromVscode.filesystem.args.some((a) => a.includes(ws)),
    '${workspaceFolder} expanded in filesystem args',
  );

  const cursorDir = path.join(ws, '.cursor-test-tmp');
  fs.mkdirSync(cursorDir, { recursive: true });
  const cursorFile = path.join(cursorDir, 'mcp.json');
  fs.writeFileSync(
    cursorFile,
    JSON.stringify({
      mcpServers: {
        cursorOnly: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] },
      },
    }),
  );
  const fromCursor = readConfigFile(cursorFile, ws);
  assert(fromCursor?.cursorOnly?.type === 'stdio', 'Cursor mcpServers shape parses');

  const merged = loadMergedConfig(ws);
  assert(merged.memory && merged.filesystem, 'fixture workspace merge includes vscode servers');
  console.log('CONFIG OK:', Object.keys(merged).join(', '));
  fs.rmSync(cursorDir, { recursive: true, force: true });
}

async function pingServer(name, config) {
  const transport =
    config.type === 'stdio'
      ? new StdioClientTransport({
          command: config.command,
          args: config.args ?? [],
          env: config.env,
          cwd: config.cwd,
        })
      : null;
  assert(transport, `${name}: only stdio tested headlessly`);

  const client = new Client({ name: 'mcp-watchdog-test', version: '0.0.0' }, { capabilities: {} });
  const start = Date.now();
  try {
    await client.connect(transport);
    await client.ping({ timeout: 15_000 });
    const ms = Date.now() - start;
    console.log(`PING OK [${name}] ${ms}ms`);
    return ms;
  } finally {
    await client.close().catch(() => {});
  }
}

async function assertRuntimeTests() {
  const servers = readConfigFile(path.join(FIXTURE_ROOT, '.vscode', 'mcp.json'), FIXTURE_ROOT);
  assert(servers, 'fixture mcp.json missing');

  await pingServer('memory', servers.memory);
  await pingServer('filesystem', servers.filesystem);
}

async function main() {
  console.log('--- config ---');
  assertConfigTests();
  console.log('--- runtime (memory server) ---');
  await assertRuntimeTests();
  console.log('\nINTEGRATION OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
