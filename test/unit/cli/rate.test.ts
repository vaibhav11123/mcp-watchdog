import { describe, expect, it, vi, afterEach } from 'vitest';
import { spawn } from 'child_process';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

function installSpawnMock(): void {
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
      kill: () => undefined,
    };
    return child as unknown as ReturnType<typeof spawn>;
  });
}

function ghCalls(): unknown[][] {
  return vi.mocked(spawn).mock.calls.filter((call) => call[0] === 'gh');
}

describe('runCliRate', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('declining makes no star API call', async () => {
    installSpawnMock();
    const { runCliRate } = await import('../../../src/cli/rate');
    const result = await runCliRate({
      appName: 'Cursor',
      confirmStar: async () => false,
    });
    expect(result.githubStar).toBe('declined');
    expect(result.hostConnection).toBe('unknown');
    expect(result.store.url).toContain('open-vsx.org');
    expect(result.note).toMatch(/only after you confirm/);
    expect(ghCalls()).toEqual([]);
  });

  it('--yes confirms the star write and calls the star API', async () => {
    installSpawnMock();
    const { runCliRate } = await import('../../../src/cli/rate');
    const result = await runCliRate({ appName: 'Cursor', yes: true });
    expect(result.githubStar).not.toBe('declined');
    const args = ghCalls().map((call) => call[1]);
    expect(args.some((a) => Array.isArray(a) && a.includes('PUT'))).toBe(true);
    expect(
      args.some((a) => Array.isArray(a) && a.some((part) => String(part).includes('user/starred'))),
    ).toBe(true);
  });

  it('an injected yes confirms the star write', async () => {
    installSpawnMock();
    const { runCliRate } = await import('../../../src/cli/rate');
    await runCliRate({ appName: 'Cursor', confirmStar: async () => true });
    expect(ghCalls().some((call) => Array.isArray(call[1]) && call[1].includes('PUT'))).toBe(true);
  });
});
