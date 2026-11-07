import { describe, expect, it } from 'vitest';
import {
  cooldownMsAfterToast,
  parseOwnerRepo,
  shouldShowStarToast,
  type GithubStarState,
} from '../../src/githubStarCore';

describe('parseOwnerRepo', () => {
  it('parses https and owner/repo', () => {
    expect(parseOwnerRepo('https://github.com/vaibhav11123/mcp-watchdog.git')).toEqual({
      owner: 'vaibhav11123',
      repo: 'mcp-watchdog',
    });
    expect(parseOwnerRepo('vaibhav11123/mcp-watchdog')).toEqual({
      owner: 'vaibhav11123',
      repo: 'mcp-watchdog',
    });
  });
});

describe('shouldShowStarToast', () => {
  const base: GithubStarState = {
    installFirstSeenAt: 0,
    toastCount: 0,
  };

  it('blocks when suppressed or capped', () => {
    expect(shouldShowStarToast({ ...base, suppressToast: true }, 1e15)).toBe(false);
    expect(shouldShowStarToast({ ...base, toastCount: 3 }, 1e15)).toBe(false);
  });

  it('requires install age unless debug', () => {
    const now = Date.now();
    const state = { ...base, installFirstSeenAt: now };
    expect(shouldShowStarToast(state, now)).toBe(false);
    expect(shouldShowStarToast(state, now, { debugBypassAge: true })).toBe(true);
  });

  it('enforces cooldown after prior toast', () => {
    const now = 1_000_000;
    const state: GithubStarState = {
      installFirstSeenAt: 0,
      toastCount: 1,
      lastToastAt: now - 1000,
    };
    expect(shouldShowStarToast(state, now)).toBe(false);
    expect(shouldShowStarToast(state, now + cooldownMsAfterToast(1))).toBe(true);
  });

  it('blocks second toast in same session', () => {
    expect(
      shouldShowStarToast({ ...base, installFirstSeenAt: 0 }, 1e15, {
        sessionAlreadyShown: true,
      }),
    ).toBe(false);
  });
});
