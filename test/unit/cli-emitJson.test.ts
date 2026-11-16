import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emitJson } from '../../src/cli/emitJson';

describe('emitJson token budget (F5)', () => {
  const dirs: string[] = [];
  const writes: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
    writes.length = 0;
  });

  it('spills when 10 failed servers JSON exceeds budget', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-emit-'));
    dirs.push(cwd);
    vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write);

    const failed = Array.from({ length: 10 }, (_, i) => ({
      name: `srv${i}`,
      state: 'failed',
      causeId: 'spawn.closed',
      lastError: 'x'.repeat(400),
      hostConnection: 'unknown',
    }));
    emitJson(
      {
        ok: false,
        dualTruth: { watchdog: 'failed', host: 'unknown' },
        servers: failed,
      },
      { cwd, budgetBytes: 2048 },
    );

    const out = writes.join('');
    expect(Buffer.byteLength(out, 'utf8')).toBeLessThanOrEqual(2048 + 64);
    const parsed = JSON.parse(out.trim());
    expect(parsed.spilled).toBe(true);
    expect(fs.existsSync(parsed.path)).toBe(true);
  });
});
