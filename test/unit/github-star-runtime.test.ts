import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { openExternal, showInformationMessage, getSession } = vi.hoisted(() => ({
  openExternal: vi.fn(async () => true),
  showInformationMessage: vi.fn(async () => undefined),
  getSession: vi.fn(async () => undefined),
}));

vi.mock('vscode', () => ({
  ExtensionMode: { Production: 1, Development: 2, Test: 3 },
  Uri: { parse: (s: string) => ({ toString: () => s }) },
  env: { openExternal },
  window: { showInformationMessage },
  authentication: { getSession },
  commands: { registerCommand: () => ({ dispose: () => undefined }) },
}));

vi.mock('../../src/telemetry/client', () => ({
  track: vi.fn(),
}));

import {
  setFetchForTests,
  setGetGithubSessionForTests,
  setSpawnGhForTests,
  starViaGhOrBrowser,
  type FetchLike,
} from '../../src/githubStar';

function fakeContext(): {
  extensionMode: number;
  extension: { packageJSON: { version: string; repository: { url: string } } };
  globalState: {
    get: <T>(key: string) => T | undefined;
    update: (key: string, value: unknown) => Promise<void>;
  };
} {
  const store = new Map<string, unknown>();
  return {
    extensionMode: 1,
    extension: {
      packageJSON: {
        version: '0.5.14',
        repository: { url: 'https://github.com/vaibhav11123/mcp-watchdog' },
      },
    },
    globalState: {
      get: <T>(key: string) => store.get(key) as T | undefined,
      update: async (key: string, value: unknown) => {
        store.set(key, value);
      },
    },
  };
}

describe('starViaGhOrBrowser silent UX', () => {
  beforeEach(() => {
    openExternal.mockClear();
    showInformationMessage.mockClear();
    getSession.mockClear();
    setGetGithubSessionForTests(async () => undefined);
    setSpawnGhForTests(async () => ({ code: null, stdout: '' }));
    setFetchForTests(undefined);
  });

  afterEach(() => {
    setGetGithubSessionForTests(undefined);
    setSpawnGhForTests(undefined);
    setFetchForTests(undefined);
  });

  it('silent path never opens browser or shows UI when auth is missing', async () => {
    const ctx = fakeContext() as unknown as import('vscode').ExtensionContext;
    const method = await starViaGhOrBrowser(ctx, { silent: true });
    expect(method).toBe('silent_skipped');
    expect(openExternal).not.toHaveBeenCalled();
    expect(showInformationMessage).not.toHaveBeenCalled();
  });

  it('silent path stars via editor token without UI', async () => {
    const calls: string[] = [];
    const fetchMock: FetchLike = async (url, init) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (init?.method === 'GET') return { status: 404 };
      return { status: 204 };
    };
    setFetchForTests(fetchMock);
    setGetGithubSessionForTests(async ({ silent }) => {
      expect(silent).toBe(true);
      return { accessToken: 'test-token' };
    });

    const ctx = fakeContext() as unknown as import('vscode').ExtensionContext;
    const method = await starViaGhOrBrowser(ctx, { silent: true });
    expect(method).toBe('silent_vscode');
    expect(calls).toEqual([
      'GET https://api.github.com/user/starred/vaibhav11123/mcp-watchdog',
      'PUT https://api.github.com/user/starred/vaibhav11123/mcp-watchdog',
    ]);
    expect(openExternal).not.toHaveBeenCalled();
    expect(showInformationMessage).not.toHaveBeenCalled();
  });

  it('silent path stars via gh without UI', async () => {
    setGetGithubSessionForTests(async () => undefined);
    setSpawnGhForTests(async (args) => {
      if (args.includes('-i')) return { code: 0, stdout: 'HTTP/2 404\n' };
      if (args.includes('PUT')) return { code: 0, stdout: '' };
      return { code: null, stdout: '' };
    });

    const ctx = fakeContext() as unknown as import('vscode').ExtensionContext;
    const method = await starViaGhOrBrowser(ctx, { silent: true });
    expect(method).toBe('silent_gh');
    expect(openExternal).not.toHaveBeenCalled();
    expect(showInformationMessage).not.toHaveBeenCalled();
  });

  it('non-silent falls back to browser only after auth fails', async () => {
    setGetGithubSessionForTests(async () => undefined);
    setSpawnGhForTests(async () => ({ code: null, stdout: '' }));

    const ctx = fakeContext() as unknown as import('vscode').ExtensionContext;
    const method = await starViaGhOrBrowser(ctx, { silent: false });
    expect(method).toBe('browser');
    expect(openExternal).toHaveBeenCalledTimes(1);
  });
});
