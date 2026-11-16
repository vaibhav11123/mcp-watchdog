import { describe, expect, it } from 'vitest';
import { mergeVerifiedOutcome } from '../../src/verifiedOutcome';
import type { ServerStatus } from '../../src/monitor';

const base = (
  partial: Partial<ServerStatus> & Pick<ServerStatus, 'name' | 'state'>,
): ServerStatus => ({
  retryCount: 0,
  ...partial,
});

describe('mergeVerifiedOutcome (S-VERIFY-01 / O4)', () => {
  it('keeps resolved through healthy status ticks', () => {
    const prev = base({
      name: 'echo',
      state: 'failed',
      verifiedOutcome: 'resolved',
    });
    expect(mergeVerifiedOutcome(prev, { state: 'healthy' })).toBe('resolved');
  });

  it('keeps unresolved on failed when not freshly set on next', () => {
    const prev = base({
      name: 'echo',
      state: 'failed',
      verifiedOutcome: 'unresolved',
    });
    expect(mergeVerifiedOutcome(prev, { state: 'failed' })).toBe('unresolved');
  });

  it('prefers freshly set outcome on next', () => {
    const prev = base({ name: 'echo', state: 'failed', verifiedOutcome: 'unresolved' });
    expect(mergeVerifiedOutcome(prev, { state: 'healthy', verifiedOutcome: 'resolved' })).toBe(
      'resolved',
    );
  });

  it('clears sticky verify when leaving healthy into a new failure', () => {
    const prev = base({
      name: 'echo',
      state: 'healthy',
      verifiedOutcome: 'resolved',
    });
    expect(mergeVerifiedOutcome(prev, { state: 'failed' })).toBeUndefined();
  });
});
