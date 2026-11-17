import { describe, expect, it, vi, afterEach } from 'vitest';
import { spawn } from 'child_process';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

describe('runCliRate', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns rate JSON with github + store legs without throwing', async () => {
    const spawnMock = vi.mocked(spawn);
    spawnMock.mockImplementation((_cmd: string, _args?: readonly string[]) => {
      const handlers: Record<string, Array<(...a: unknown[]) => void>> = {};
      const child = {
        stdout: {
          on: (ev: string, fn: (...a: unknown[]) => void) => {
            if (ev === 'data') handlers.data = handlers.data || [];
            handlers.data?.push(fn);
            return child.stdout;
          },
        },
        on: (ev: string, fn: (...a: unknown[]) => void) => {
          handlers[ev] = handlers[ev] || [];
          handlers[ev]!.push(fn);
          if (ev === 'close') {
            setTimeout(() => fn(1), 0);
          }
          return child;
        },
        unref: () => undefined,
      };
      return child as unknown as ReturnType<typeof spawn>;
    });

    const { runCliRate } = await import('../../../src/cli/rate');
    const result = await runCliRate({ appName: 'Cursor' });
    expect(result.ok).toBe(true);
    expect(result.command).toBe('rate');
    expect(result.hostConnection).toBe('unknown');
    expect(result.store.url).toContain('open-vsx.org');
    expect(result.note).toMatch(/Does not auto-post/);
  });
});
