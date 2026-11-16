import { describe, expect, it } from 'vitest';
import { mapPool } from '../../src/cli/mapPool';

describe('mapPool', () => {
  it('respects concurrency and preserves order', async () => {
    let active = 0;
    let maxActive = 0;
    const out = await mapPool([1, 2, 3, 4, 5], 2, async (n) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50]);
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
