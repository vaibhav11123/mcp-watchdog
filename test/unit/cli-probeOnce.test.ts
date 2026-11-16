import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { probeServerOnce } from '../../src/cli/probeOnce';

const echoFixture = path.join(__dirname, '../../mcp-watchdog-test/fixtures/echo-server.js');

describe('probeServerOnce honesty (CRITIQUE stop-clobber)', () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const d of tmpDirs) {
      fs.rmSync(d, { recursive: true, force: true });
    }
    tmpDirs.length = 0;
  });

  it('reports healthy for echo fixture — not disconnected after stop()', async () => {
    const report = await probeServerOnce('echo', {
      type: 'stdio',
      command: 'node',
      args: [echoFixture],
    });
    expect(report.state).toBe('healthy');
    expect(report.hostConnection).toBe('unknown');
    expect(report.causeId).toBeUndefined();
  }, 20_000);

  it('classifies ENOENT without clobbering to generic', async () => {
    // Bare missing name (not a Unix-only absolute path) so Windows CreateProcess
    // still surfaces a missing-binary error the classifier can map to spawn.enoent.
    const report = await probeServerOnce('missing', {
      type: 'stdio',
      command: 'mcp-watchdog-missing-binary-xyz-9f3a',
      args: [],
    });
    // Interval probe maps spawn fail → degraded/failed; cause must stay spawn.enoent
    // (not stop-clobber generic / retryExhausted → spawn.closed).
    expect(report.state).toMatch(/^(degraded|failed|disconnected)$/);
    expect(report.causeId).toBe('spawn.enoent');
    expect(report.hostConnection).toBe('unknown');
  }, 15_000);

  it('redacts secret-looking lastError values', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-probe-'));
    tmpDirs.push(dir);
    const script = path.join(dir, 'die.js');
    fs.writeFileSync(
      script,
      `console.error('Authorization: Bearer sk-test-secret-value-xyz'); process.exit(1);\n`,
    );
    const report = await probeServerOnce('die', {
      type: 'stdio',
      command: 'node',
      args: [script],
    });
    expect(report.state).not.toBe('healthy');
    if (report.lastError) {
      expect(report.lastError).not.toMatch(/sk-test-secret-value-xyz/);
    }
  }, 15_000);
});
