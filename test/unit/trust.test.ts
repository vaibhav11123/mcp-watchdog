import { describe, expect, it } from 'vitest';
import type { McpServerConfig } from '../../src/config-core';
import {
  computeServerSetFingerprint,
  displayUrl,
  formatServerSummary,
  TrustStore,
} from '../../src/trust';

function makeMemoryMemento(): {
  store: Map<string, unknown>;
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Promise<void>;
} {
  const store = new Map<string, unknown>();
  return {
    store,
    get<T>(key: string): T | undefined {
      return store.get(key) as T | undefined;
    },
    async update(key: string, value: unknown): Promise<void> {
      if (value === undefined) {
        store.delete(key);
      } else {
        store.set(key, value);
      }
    },
  };
}

const baseServers = (): Record<string, McpServerConfig> => ({
  alpha: { type: 'stdio', command: 'node', args: ['a.js'] },
  beta: { type: 'http', url: 'http://localhost:3000/mcp', headers: { Authorization: 'secret' } },
});

describe('computeServerSetFingerprint', () => {
  it('is order-independent', () => {
    const a = computeServerSetFingerprint({
      z: { type: 'stdio', command: 'echo' },
      a: { type: 'http', url: 'http://x' },
    });
    const b = computeServerSetFingerprint({
      a: { type: 'http', url: 'http://x' },
      z: { type: 'stdio', command: 'echo' },
    });
    expect(a).toBe(b);
  });

  it('changes when command, args, or url change', () => {
    const base = computeServerSetFingerprint(baseServers());
    const cmd = computeServerSetFingerprint({
      ...baseServers(),
      alpha: { type: 'stdio', command: 'python', args: ['a.js'] },
    });
    const args = computeServerSetFingerprint({
      ...baseServers(),
      alpha: { type: 'stdio', command: 'node', args: ['b.js'] },
    });
    const url = computeServerSetFingerprint({
      ...baseServers(),
      beta: {
        type: 'http',
        url: 'http://localhost:4000/mcp',
        headers: { Authorization: 'secret' },
      },
    });
    expect(cmd).not.toBe(base);
    expect(args).not.toBe(base);
    expect(url).not.toBe(base);
  });

  it('distinguishes http vs sse for the same url', () => {
    const httpFp = computeServerSetFingerprint({
      s: { type: 'http', url: 'http://localhost/x' },
    });
    const sseFp = computeServerSetFingerprint({
      s: { type: 'sse', url: 'http://localhost/x' },
    });
    expect(httpFp).not.toBe(sseFp);
  });

  it('does not change when only env or header values change', () => {
    const a = computeServerSetFingerprint({
      mem: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', 'pkg'],
        env: { API_KEY: 'one' },
      },
      api: {
        type: 'http',
        url: 'http://localhost/mcp',
        headers: { Authorization: 'alpha' },
      },
    });
    const b = computeServerSetFingerprint({
      mem: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', 'pkg'],
        env: { API_KEY: 'two' },
      },
      api: {
        type: 'http',
        url: 'http://localhost/mcp',
        headers: { Authorization: 'beta' },
      },
    });
    expect(a).toBe(b);
  });

  it('changes when cwd or env key set changes', () => {
    const base = computeServerSetFingerprint({
      mem: {
        type: 'stdio',
        command: 'npx',
        args: ['pkg'],
        cwd: '/a',
        env: { API_KEY: 'one' },
      },
    });
    const cwd = computeServerSetFingerprint({
      mem: {
        type: 'stdio',
        command: 'npx',
        args: ['pkg'],
        cwd: '/b',
        env: { API_KEY: 'one' },
      },
    });
    const envKeys = computeServerSetFingerprint({
      mem: {
        type: 'stdio',
        command: 'npx',
        args: ['pkg'],
        cwd: '/a',
        env: { API_KEY: 'one', OTHER: 'x' },
      },
    });
    expect(cwd).not.toBe(base);
    expect(envKeys).not.toBe(base);
  });
});

describe('formatServerSummary / displayUrl', () => {
  it('strips query tokens from http summaries', () => {
    expect(displayUrl('https://x.example/mcp?token=secret')).not.toContain('secret');
    expect(
      formatServerSummary({
        type: 'http',
        url: 'https://x.example/mcp?token=secret',
      }),
    ).not.toContain('secret');
  });
});

describe('TrustStore', () => {
  it('round-trips approval via memento', async () => {
    const memento = makeMemoryMemento();
    const store = new TrustStore(memento, '/workspace/proj');

    expect(store.get()).toBeUndefined();
    await store.approve('fp-abc', ['alpha', 'beta']);
    expect(store.get()).toEqual({ fingerprint: 'fp-abc', allowedServers: ['alpha', 'beta'] });
    expect(store.isServerAllowed('fp-abc', 'alpha')).toBe(true);
    expect(store.isServerAllowed('fp-abc', 'gamma')).toBe(false);
    expect(store.isServerAllowed('other-fp', 'alpha')).toBe(false);

    await store.revoke();
    expect(store.get()).toBeUndefined();
  });
});
