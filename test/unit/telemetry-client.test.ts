import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const logUsage = vi.fn();

vi.mock('vscode', () => ({
  ExtensionMode: { Production: 1, Development: 2, Test: 3 },
  env: {
    isTelemetryEnabled: true,
    appName: 'Cursor',
    createTelemetryLogger: () => ({
      logUsage,
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
      update: async () => undefined,
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
  init,
  postCapture,
  resetTelemetryForTests,
  setCredentialsForTests,
  setFetchForTests,
  track,
  type FetchLike,
} from '../../src/telemetry/client';

describe('canSend', () => {
  const base = {
    watchdogEnabled: true,
    vscodeTelemetryEnabled: true,
    extensionMode: 1 as const,
    apiKey: 'phc_test',
  };

  it('requires api key, both gates, and non-Test mode', () => {
    expect(canSend(base)).toBe(true);
    expect(canSend({ ...base, apiKey: '' })).toBe(false);
    expect(canSend({ ...base, watchdogEnabled: false })).toBe(false);
    expect(canSend({ ...base, vscodeTelemetryEnabled: false })).toBe(false);
    expect(canSend({ ...base, extensionMode: 3 })).toBe(false);
  });

  it('allows ignoring Watchdog setting for opt-out event', () => {
    expect(canSend({ ...base, watchdogEnabled: false, ignoreWatchdogSetting: true })).toBe(true);
  });

  it('blocks Development unless debug env is 1', () => {
    expect(canSend({ ...base, extensionMode: 2 })).toBe(false);
    expect(canSend({ ...base, extensionMode: 2, debugEnv: '1' })).toBe(true);
  });
});

describe('buildCaptureBody', () => {
  it('rejects missing event, distinct_id, or prefixed names', () => {
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
        event: 'mcp-watchdog.mcp-watchdog/activation',
        properties: {},
      }),
    ).toBeUndefined();
  });

  it('builds valid body for bare event names', () => {
    const body = buildCaptureBody({
      apiKey: ' phc_x ',
      distinctId: 'install-1',
      event: 'activation',
      properties: { extVersion: '0.5.6', $lib: 'mcp-watchdog' },
    });
    expect(body).toMatchObject({
      api_key: 'phc_x',
      distinct_id: 'install-1',
      event: 'activation',
    });
  });

  it('allows ui_command', () => {
    expect(
      buildCaptureBody({
        apiKey: 'k',
        distinctId: 'd',
        event: 'ui_command',
        properties: { command: 'showStatus' },
      }),
    ).toBeDefined();
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

describe('track → Capture', () => {
  const globalState = new Map<string, unknown>();
  const context = {
    extensionMode: 1,
    globalState: {
      get: <T>(key: string) => globalState.get(key) as T | undefined,
      update: async (key: string, value: unknown) => {
        globalState.set(key, value);
      },
    },
    subscriptions: [] as { dispose(): void }[],
    extension: { packageJSON: { version: '0.5.6' } },
  };

  beforeEach(() => {
    globalState.clear();
    logUsage.mockClear();
    resetTelemetryForTests();
    setCredentialsForTests('phc_test', 'https://us.i.posthog.com');
  });

  afterEach(() => {
    resetTelemetryForTests();
    setFetchForTests(undefined);
    setCredentialsForTests(undefined, undefined);
  });

  it('POSTs bare event names (not extensionId/event)', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 }));
    setFetchForTests(fetchImpl as FetchLike);
    init(context as never);

    track('activation', {
      extVersion: '0.5.6',
      editor: 'Cursor',
      vscodeVersion: '1.0.0',
      serverCount: 2,
      monitoringCount: 1,
      probeMode: 'interval',
      cloudBridgeEnabled: false,
      authProbeEnabledCount: 0,
      $set: { extVersion: '0.5.6', editor: 'Cursor' },
      $set_once: { firstEditor: 'Cursor' },
    });

    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    const sent = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(sent.event).toBe('activation');
    expect(sent.event).not.toContain('/');
    expect(sent.properties.serverCount).toBe(2);
    expect(sent.properties.monitoringCount).toBe(1);
  });

  it('sends telemetry.enabled=false opt-out event (ignoreWatchdogSetting path)', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 }));
    setFetchForTests(fetchImpl as FetchLike);
    const vscodeMod = await import('vscode');
    vi.spyOn(vscodeMod.workspace, 'getConfiguration').mockReturnValue({
      get: () => false,
      update: async () => undefined,
    } as never);

    init(context as never);
    track('settings_change', { key: 'telemetry.enabled', value: false });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    const sent = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(sent.event).toBe('settings_change');
    expect(sent.properties.value).toBe(false);

    fetchImpl.mockClear();
    track('activation', {
      extVersion: '0.5.6',
      editor: 'Cursor',
      vscodeVersion: '1',
      serverCount: 0,
      monitoringCount: 0,
      probeMode: 'none',
      cloudBridgeEnabled: false,
      authProbeEnabledCount: 0,
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
