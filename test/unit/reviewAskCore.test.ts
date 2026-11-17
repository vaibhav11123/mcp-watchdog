import { describe, expect, it } from 'vitest';
import {
  resolvePrimaryStore,
  resolveOpenStrategy,
  shouldOfferAsk,
  EXTENSION_ID,
  OPEN_VSX_URL,
  MARKETPLACE_URL,
} from '../../src/reviewAskCore';

describe('resolvePrimaryStore / resolveOpenStrategy', () => {
  it('maps Cursor and forks to Open VSX', () => {
    expect(resolvePrimaryStore('Cursor')).toBe('openvsx');
    expect(resolvePrimaryStore('Windsurf')).toBe('openvsx');
    expect(resolvePrimaryStore('VSCodium')).toBe('openvsx');
    const s = resolveOpenStrategy('Cursor');
    expect(s.kind).toBe('open_external');
    if (s.kind === 'open_external') {
      expect(s.url).toBe(OPEN_VSX_URL);
      expect(s.rateLabel).toContain('Open VSX');
    }
  });

  it('maps Visual Studio Code to Marketplace extension.open', () => {
    expect(resolvePrimaryStore('Visual Studio Code')).toBe('marketplace');
    const s = resolveOpenStrategy('Visual Studio Code');
    expect(s.kind).toBe('extension_open');
    if (s.kind === 'extension_open') {
      expect(s.extensionId).toBe(EXTENSION_ID);
      expect(s.fallbackUrl).toBe(MARKETPLACE_URL);
      expect(s.rateLabel).toContain('Marketplace');
    }
  });

  it('defaults unknown hosts to Open VSX (ICP)', () => {
    expect(resolvePrimaryStore('')).toBe('openvsx');
    expect(resolvePrimaryStore('SomethingElse')).toBe('openvsx');
  });
});

describe('shouldOfferAsk', () => {
  it('B1: threshold 0 → noop', () => {
    expect(
      shouldOfferAsk({
        threshold: 0,
        askedReview: false,
        recoveryCount: 99,
        askInFlight: false,
      }),
    ).toEqual({ action: 'noop' });
  });

  it('B2: count below threshold → count_only', () => {
    expect(
      shouldOfferAsk({
        threshold: 3,
        askedReview: false,
        recoveryCount: 1,
        askInFlight: false,
      }),
    ).toEqual({ action: 'count_only', nextCount: 2 });
  });

  it('B3: count reaches threshold → offer', () => {
    expect(
      shouldOfferAsk({
        threshold: 3,
        askedReview: false,
        recoveryCount: 2,
        askInFlight: false,
      }),
    ).toEqual({ action: 'offer', nextCount: 3 });
  });

  it('B4: already asked → noop', () => {
    expect(
      shouldOfferAsk({
        threshold: 3,
        askedReview: true,
        recoveryCount: 10,
        askInFlight: false,
      }),
    ).toEqual({ action: 'noop' });
  });

  it('in-flight → noop (double recovery latch)', () => {
    expect(
      shouldOfferAsk({
        threshold: 3,
        askedReview: false,
        recoveryCount: 2,
        askInFlight: true,
      }),
    ).toEqual({ action: 'noop' });
  });

  it('B20: raised threshold uses new value vs count', () => {
    expect(
      shouldOfferAsk({
        threshold: 5,
        askedReview: false,
        recoveryCount: 3,
        askInFlight: false,
      }),
    ).toEqual({ action: 'count_only', nextCount: 4 });
    expect(
      shouldOfferAsk({
        threshold: 5,
        askedReview: false,
        recoveryCount: 4,
        askInFlight: false,
      }),
    ).toEqual({ action: 'offer', nextCount: 5 });
  });
});
