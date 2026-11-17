import { describe, expect, it, vi, afterEach } from 'vitest';
import { spawn } from 'child_process';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

function mockSpawnAlwaysFail(): void {
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
}

describe('runCliRate', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('without --star: no gh star API write; githubStar declined', async () => {
    mockSpawnAlwaysFail();
    const { runCliRate } = await import('../../../src/cli/rate');
    const result = await runCliRate({ appName: 'Cursor' });
    expect(result.ok).toBe(true);
    expect(result.githubStar).toBe('declined');
    expect(result.note).toMatch(/pass --star/);
    expect(result.store.url).toContain('open-vsx.org');

    const spawnMock = vi.mocked(spawn);
    const ghApiCalls = spawnMock.mock.calls.filter(
      (c) => c[0] === 'gh' && Array.isArray(c[1]) && (c[1] as string[]).includes('api'),
    );
    expect(ghApiCalls).toHaveLength(0);
  });

  it('with --star: attempts gh star path (disclosed write)', async () => {
    mockSpawnAlwaysFail();
    const { runCliRate } = await import('../../../src/cli/rate');
    const result = await runCliRate({ appName: 'Cursor', star: true });
    expect(result.ok).toBe(true);
    expect(result.githubStar).not.toBe('declined');
    expect(result.note).toMatch(/Star leg requested/);

    const spawnMock = vi.mocked(spawn);
    const ghApiCalls = spawnMock.mock.calls.filter(
      (c) => c[0] === 'gh' && Array.isArray(c[1]) && (c[1] as string[]).includes('api'),
    );
    expect(ghApiCalls.length).toBeGreaterThan(0);
  });
});
