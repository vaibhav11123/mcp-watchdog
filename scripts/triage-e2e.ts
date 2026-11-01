/**
 * Offline triage smoke: classifyFailure, chip accept math, mcp.json delete.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { classifyFailure, statusesForChip } from '../src/failureTriage';
import { deleteServerKey } from '../src/mcpJsonEdit';
import { buildStatusBarModel } from '../src/ui/statusBarModel';
import type { ServerStatus } from '../src/monitor';

function fail(msg: string): never {
  console.error(`TRIAGE_E2E FAIL: ${msg}`);
  process.exit(1);
}

function ok(cond: boolean, msg: string): void {
  if (!cond) fail(msg);
}

function main(): void {
  ok(
    classifyFailure({ serverName: 'echo', lastError: 'Probe OK (12ms)' }) === 'generic',
    'healthy echo string should classify generic',
  );
  ok(
    classifyFailure({ serverName: 'echo', lastError: 'spawn echo ENOENT' }) === 'spawn',
    'ENOENT should classify spawn',
  );

  const statuses: ServerStatus[] = [
    { name: 'a', state: 'healthy', retryCount: 0 },
    { name: 'b', state: 'healthy', retryCount: 0 },
    { name: 'c', state: 'failed', retryCount: 3 },
  ];
  ok(buildStatusBarModel(statuses).text.includes('2/3'), 'chip before accept');
  const chip = statusesForChip(statuses, ['c']);
  ok(buildStatusBarModel(chip).text.includes('2/2'), 'chip after accept');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-watchdog-triage-'));
  const file = path.join(dir, 'mcp.json');
  const raw = JSON.stringify(
    { mcpServers: { echo: { command: 'echo' }, other: { command: 'node' } } },
    null,
    2,
  );
  fs.writeFileSync(file, raw, 'utf8');
  const del = deleteServerKey(raw, 'echo');
  ok(del.ok === true, 'deleteServerKey ok');
  if (del.ok) {
    fs.writeFileSync(file, del.raw, 'utf8');
    const after = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      mcpServers: Record<string, unknown>;
    };
    ok(!('echo' in after.mcpServers), 'echo key removed');
    ok('other' in after.mcpServers, 'sibling preserved');
  }

  const jsonc = '{ /* comment */ "mcpServers": {} }';
  ok(deleteServerKey(jsonc, 'x').ok === false, 'JSONC refused');

  fs.rmSync(dir, { recursive: true, force: true });
  console.log('TRIAGE_E2E PASS');
  process.exit(0);
}

main();
