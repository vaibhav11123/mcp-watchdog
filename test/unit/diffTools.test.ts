import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { diffTools, toolsSnapshotHash } from '../../packages/probe-core/src/index';

const FIXTURE_DIR = join(__dirname, '../../packages/probe-core/fixtures/schema');

describe('diffTools goldens', () => {
  const files = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json'));
  expect(files.length).toBeGreaterThanOrEqual(20);

  for (const file of files) {
    it(file.replace(/\.json$/, ''), () => {
      const raw = JSON.parse(readFileSync(join(FIXTURE_DIR, file), 'utf8')) as {
        before: Parameters<typeof diffTools>[0];
        after: Parameters<typeof diffTools>[1];
        expectBreaking: string[];
        expectInfo: string[];
        expectPatch?: string[];
      };
      const result = diffTools(raw.before, raw.after);
      const breakingCodes = result.breaking.map((c) => c.code);
      const infoCodes = result.info.map((c) => c.code);
      const patchCodes = result.patch.map((c) => c.code);
      for (const code of raw.expectBreaking) {
        expect(breakingCodes, `missing breaking ${code}`).toContain(code);
      }
      for (const code of raw.expectInfo) {
        expect(infoCodes, `missing info ${code}`).toContain(code);
      }
      for (const code of raw.expectPatch ?? []) {
        expect(patchCodes, `missing patch ${code}`).toContain(code);
      }
      if (
        raw.expectBreaking.length === 0 &&
        raw.expectInfo.length === 0 &&
        (raw.expectPatch?.length ?? 0) === 0
      ) {
        expect(result.changes).toEqual([]);
      }
    });
  }

  it('reorder yields stable hash', () => {
    const a = [
      { name: 'b', description: '', inputSchema: { type: 'object', properties: {} } },
      { name: 'a', description: '', inputSchema: { type: 'object', properties: {} } },
    ];
    const b = [
      { name: 'a', description: '', inputSchema: { type: 'object', properties: {} } },
      { name: 'b', description: '', inputSchema: { type: 'object', properties: {} } },
    ];
    expect(toolsSnapshotHash(a)).toBe(toolsSnapshotHash(b));
    expect(diffTools(a, b).changes).toEqual([]);
  });
});
