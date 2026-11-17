import { beforeEach, describe, expect, it, vi } from 'vitest';

const { showInformationMessage, showWarningMessage, openExternal, starViaGhOrBrowser } = vi.hoisted(
  () => ({
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    openExternal: vi.fn(async () => true),
    starViaGhOrBrowser: vi.fn(async () => 'silent_vscode' as const),
  }),
);

vi.mock('vscode', () => ({
  ExtensionMode: { Production: 1, Development: 2, Test: 3 },
  Uri: { parse: (s: string) => ({ toString: () => s }) },
  env: { openExternal, appName: 'Cursor' },
  window: { showInformationMessage, showWarningMessage },
  commands: {
    executeCommand: vi.fn(async () => undefined),
    registerCommand: () => ({ dispose: () => undefined }),
  },
  workspace: { getConfiguration: () => ({ get: (_k: string, fallback?: unknown) => fallback }) },
  authentication: { getSession: vi.fn() },
}));

vi.mock('../../src/githubStar', () => ({
  starViaGhOrBrowser,
  repoHttpsUrl: () => 'https://github.com/vaibhav11123/mcp-watchdog',
}));

vi.mock('../../src/telemetry/client', () => ({
  track: vi.fn(),
}));

import { RATE_ACTION_OPENVSX } from '../../src/reviewAskCore';
import { presentAsk } from '../../src/reviewAsk';

function ctx(): import('vscode').ExtensionContext {
  return {} as import('vscode').ExtensionContext;
}

describe('presentAsk star disclosure', () => {
  beforeEach(() => {
    showInformationMessage.mockReset();
    showWarningMessage.mockReset();
    openExternal.mockClear();
    starViaGhOrBrowser.mockClear();
  });

  it('one click uses the disclosed label and does not open a second dialog', async () => {
    showInformationMessage.mockResolvedValue(undefined);
    await presentAsk(ctx(), 'command');
    expect(showInformationMessage).toHaveBeenCalledTimes(1);
    expect(showWarningMessage).not.toHaveBeenCalled();
    const buttons = showInformationMessage.mock.calls[0]!.slice(1);
    expect(buttons).toEqual([RATE_ACTION_OPENVSX, 'Not now', 'Send feedback']);
    expect(buttons.some((b: string) => /^Rate\b/.test(b))).toBe(false);
  });

  it('dismiss writes no star', async () => {
    showInformationMessage.mockResolvedValue(undefined);
    await presentAsk(ctx(), 'command');
    expect(starViaGhOrBrowser).not.toHaveBeenCalled();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('Not now writes no star', async () => {
    showInformationMessage.mockResolvedValue('Not now');
    await presentAsk(ctx(), 'command');
    expect(starViaGhOrBrowser).not.toHaveBeenCalled();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('Send feedback writes no star', async () => {
    showInformationMessage.mockResolvedValue('Send feedback');
    await presentAsk(ctx(), 'command');
    expect(starViaGhOrBrowser).not.toHaveBeenCalled();
    expect(String(openExternal.mock.calls[0]?.[0])).toContain('/issues/');
  });

  it('the disclosed label stars and opens the store in that same click', async () => {
    showInformationMessage.mockResolvedValue(RATE_ACTION_OPENVSX);
    await presentAsk(ctx(), 'command');
    expect(showInformationMessage).toHaveBeenCalledTimes(1);
    expect(showWarningMessage).not.toHaveBeenCalled();
    expect(starViaGhOrBrowser).toHaveBeenCalledTimes(1);
    expect(String(openExternal.mock.calls[0]?.[0])).toContain('open-vsx.org');
  });
});
