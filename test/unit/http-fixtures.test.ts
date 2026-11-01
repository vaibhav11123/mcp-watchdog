import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHECK_DEFS } from '../../packages/probe-core/src/index';

const FIXTURE_DIR = join(__dirname, '../../packages/probe-core/fixtures/http');

describe('HTTP pack fixtures', () => {
  const files = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json'));

  it('every fixture is tagged with a pack and matches CHECK_DEFS', () => {
    expect(files.length).toBeGreaterThanOrEqual(9);
    for (const file of files) {
      const fix = JSON.parse(readFileSync(join(FIXTURE_DIR, file), 'utf8')) as {
        id: string;
        pack: string;
        expectedStatus: number[];
      };
      expect(['liveness', 'session', 'conformance']).toContain(fix.pack);
      const def = CHECK_DEFS.find((c) => c.id === fix.id);
      expect(def, fix.id).toBeTruthy();
      expect(def!.pack).toBe(fix.pack);
      if (fix.expectedStatus.length && def!.expectedStatus) {
        expect(fix.expectedStatus).toEqual(def!.expectedStatus);
      }
    }
  });

  it('session-unknown expects 404 not 400', () => {
    const fix = JSON.parse(readFileSync(join(FIXTURE_DIR, 'session-unknown.json'), 'utf8')) as {
      expectedStatus: number[];
    };
    expect(fix.expectedStatus).toEqual([404]);
  });
});
