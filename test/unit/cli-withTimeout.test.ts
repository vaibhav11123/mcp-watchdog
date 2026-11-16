import { describe, expect, it } from 'vitest';
import { withTimeout } from '../../src/cli/withTimeout';

describe('withTimeout', () => {
  it('resolves when work finishes in time', async () => {
    await expect(withTimeout(Promise.resolve(42), 1000, 'fast')).resolves.toBe(42);
  });

  it('rejects when work exceeds deadline', async () => {
    await expect(
      withTimeout(new Promise((r) => setTimeout(() => r(1), 200)), 30, 'slow'),
    ).rejects.toThrow(/Request timed out: slow/);
  });
});
