import { beforeEach, describe, expect, it, vi } from 'vitest';

const { showInformationMessage, openExternal, executeCommand, track, starViaGhOrBrowser } =
  vi.hoisted(() => ({
    showInformationMessage: vi.fn(),
    openExternal: vi.fn(async () => true),
    executeCommand: vi.fn(async () => undefined),
    track: vi.fn(),
    starViaGhOrBrowser: vi.fn(),
  }));

vi.mock('vscode', () => ({
  window: { showInformationMessage },
  env: { openExternal, appName: 'Cursor' },
  Uri: { parse: (s: string) => ({ toString: () => s }) },
  commands: {
    executeCommand,
    registerCommand: () => ({ dispose: () => undefined }),
  },
  workspace: { getConfiguration: () => ({ get: (_key: string, fallback?: unknown) => fallback }) },
  ExtensionMode: { Production: 1, Development: 2, Test: 3 },
}));

vi.mock('../../src/telemetry/client', () => ({
  track,
}));

vi.mock('../../src/githubStar', () => ({
  starViaGhOrBrowser,
  repoHttpsUrl: () => 'https://github.com/vaibhav11123/mcp-watchdog',
}));

import { GITHUB_STAR_CONFIRM_ACCEPT, GITHUB_STAR_CONFIRM_DECLINE } from '../../src/reviewAskCore';
import { runRateWatchdog } from '../../src/reviewAsk';

const context = {} as import('vscode').ExtensionContext;

describe('extension Rate star confirmation', () => {
  beforeEach(() => {
    showInformationMessage.mockReset();
    openExternal.mockClear();
    executeCommand.mockClear();
    track.mockClear();
    starViaGhOrBrowser.mockReset();
  });

  it('Not now makes no star API call', async () => {
    showInformationMessage.mockResolvedValue(GITHUB_STAR_CONFIRM_DECLINE);
    starViaGhOrBrowser.mockImplementation(() => {
      throw new Error('star API must not run');
    });
    await runRateWatchdog(context);
    expect(starViaGhOrBrowser).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalledWith('review_surface_opened', { surface: 'github_star' });
  });

  it('dismissing the dialog makes no star API call', async () => {
    showInformationMessage.mockResolvedValue(undefined);
    starViaGhOrBrowser.mockImplementation(() => {
      throw new Error('star API must not run');
    });
    await runRateWatchdog(context);
    expect(starViaGhOrBrowser).not.toHaveBeenCalled();
  });

  it('Star confirms the write and calls the star API', async () => {
    showInformationMessage.mockResolvedValue(GITHUB_STAR_CONFIRM_ACCEPT);
    starViaGhOrBrowser.mockResolvedValue('silent_gh');
    await runRateWatchdog(context);
    expect(starViaGhOrBrowser).toHaveBeenCalledTimes(1);
    expect(starViaGhOrBrowser).toHaveBeenCalledWith(context, { silent: true });
    expect(track).toHaveBeenCalledWith('review_surface_opened', { surface: 'github_star' });
  });
});
