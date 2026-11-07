import { describe, expect, it } from 'vitest';
import { observationFromStatus } from '../../src/observationFromStatus';
import { verifyAfterFix } from '../../src/verifyRecovery';

describe('observationFromStatus + verify', () => {
  it('healthy maps to success observation', () => {
    const o = observationFromStatus({
      name: 'echo',
      state: 'healthy',
      retryCount: 0,
    });
    expect(o.discovery).toBe('success');
    expect(o.hostConnection).toBe('unknown');
  });

  it('auth failure maps and verify resolves after healthy', () => {
    const before = observationFromStatus({
      name: 'svc',
      state: 'failed',
      retryCount: 1,
      lastError: 'No token provided',
    });
    expect(before.auth).toBe('missing');
    const after = observationFromStatus({
      name: 'svc',
      state: 'healthy',
      retryCount: 0,
    });
    expect(verifyAfterFix({ before, after })).toBe('resolved');
  });
});
