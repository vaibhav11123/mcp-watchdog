import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('vscode', () => ({
  ExtensionMode: { Production: 1, Development: 2, Test: 3 },
  env: {
    isTelemetryEnabled: true,
    createTelemetryLogger: () => ({
      logUsage: () => undefined,
      logError: () => undefined,
      dispose: () => undefined,
      isUsageEnabled: true,
      isErrorsEnabled: true,
      onDidChangeEnableStates: () => ({ dispose: () => undefined }),
    }),
    onDidChangeTelemetryEnabled: () => ({ dispose: () => undefined }),
  },
  workspace: {
    getConfiguration: () => ({
      get: (_k: string, def: unknown) => def,
    }),
    onDidChangeConfiguration: () => ({ dispose: () => undefined }),
  },
  window: {
    showInformationMessage: async () => undefined,
  },
  commands: {
    executeCommand: async () => undefined,
  },
  ConfigurationTarget: { Global: 1 },
}));

import {
  StateTransitionRateLimit,
  buildCaptureBody,
  canSend,
  postCapture,
  type FetchLike,
} from '../../src/telemetry/client';

describe('canSend', () => {
  const base = {
    watchdogEnabled: true,
    vscodeTelemetryEnabled: true,
    extensionMode: 1 as const, // Production
    apiKey: 'phc_test',
  };

  it('requires api key, both gates, and non-Test mode', () => {
    expect(canSend(base)).toBe(true);
    expect(canSend({ ...base, apiKey: '' })).toBe(false);
    expect(canSend({ ...base, watchdogEnabled: false })).toBe(false);
    expect(canSend({ ...base, vscodeTelemetryEnabled: false })).toBe(false);
    expect(canSend({ ...base, extensionMode: 3 })).toBe(false); // Test
  });

  it('blocks Development unless debug env is 1', () => {
    expect(canSend({ ...base, extensionMode: 2 })).toBe(false);
    expect(canSend({ ...base, extensionMode: 2, debugEnv: '1' })).toBe(true);
  });
});

describe('buildCaptureBody', () => {
  it('rejects missing event or distinct_id', () => {
    expect(
      buildCaptureBody({
        apiKey: 'k',
        distinctId: '',
        event: 'activation',
        properties: {},
      }),
    ).toBeUndefined();
    expect(
      buildCaptureBody({
        apiKey: 'k',
        distinctId: 'id',
        event: '',
        properties: {},
      }),
    ).toBeUndefined();
    expect(
      buildCaptureBody({
        apiKey: 'k',
        distinctId: 'id',
        event: 'not_allowed',
        properties: {},
      }),
    ).toBeUndefined();
  });

  it('builds valid body', () => {
    const body = buildCaptureBody({
      apiKey: ' phc_x ',
      distinctId: 'install-1',
      event: 'activation',
      properties: { extVersion: '0.5.5', $lib: 'mcp-watchdog' },
    });
    expect(body).toMatchObject({
      api_key: 'phc_x',
      distinct_id: 'install-1',
      event: 'activation',
    });
    expect(body?.properties.extVersion).toBe('0.5.5');
  });
});

describe('postCapture', () => {
  it('POSTs JSON and fail-softs on throw', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 }));
    const body = buildCaptureBody({
      apiKey: 'k',
      distinctId: 'd',
      event: 'activation',
      properties: { $lib: 'mcp-watchdog' },
    })!;
    await postCapture('https://us.i.posthog.com', body, fetchImpl as FetchLike);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://us.i.posthog.com/i/v0/e/',
      expect.objectContaining({ method: 'POST' }),
    );
    const sent = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(sent.api_key).toBe('k');
    expect(sent.distinct_id).toBe('d');
    expect(sent.event).toBe('activation');

    const boom = vi.fn(async () => {
      throw new Error('network');
    });
    await expect(postCapture('https://us.i.posthog.com', body, boom as FetchLike)).resolves.toBe(
      undefined,
    );
  });
});

describe('StateTransitionRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows at most one per server per window', () => {
    const rl = new StateTransitionRateLimit(30_000);
    expect(rl.allow('a', 1000)).toBe(true);
    expect(rl.allow('a', 2000)).toBe(false);
    expect(rl.allow('b', 2000)).toBe(true);
    expect(rl.allow('a', 1000 + 30_000)).toBe(true);
  });
});
