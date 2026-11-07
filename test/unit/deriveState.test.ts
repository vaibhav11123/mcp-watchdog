import { describe, expect, it } from 'vitest';
import {
  deriveServerState,
  diagnose,
  emptyObservation,
} from '../../packages/probe-core/src/diagnostics/index';

describe('deriveServerState (C-DERIVE-*)', () => {
  it('connecting when first probe in flight', () => {
    expect(
      deriveServerState({
        observation: emptyObservation(),
        connecting: true,
      }),
    ).toBe('connecting');
  });

  it('hostConnection unknown alone does not force failed', () => {
    expect(
      deriveServerState({
        observation: emptyObservation({
          hostConnection: 'unknown',
          discovery: 'success',
          transport: 'connected',
          auth: 'ok',
        }),
      }),
    ).toBe('healthy');
  });

  it('auth missing → failed', () => {
    expect(
      deriveServerState({
        observation: emptyObservation({ auth: 'missing', discovery: 'failed' }),
      }),
    ).toBe('failed');
  });

  it('process exited without discovery → disconnected', () => {
    expect(
      deriveServerState({
        observation: emptyObservation({ process: 'exited', discovery: 'unknown' }),
      }),
    ).toBe('disconnected');
  });

  it('execution failed after success → degraded', () => {
    expect(
      deriveServerState({
        observation: emptyObservation({
          discovery: 'success',
          auth: 'ok',
          transport: 'connected',
          execution: 'failed',
        }),
      }),
    ).toBe('degraded');
  });

  it('non-generic diagnosis without clear observation → failed', () => {
    const diagnosis = diagnose({ serverName: 'x', lastError: 'No token provided' });
    expect(
      deriveServerState({
        observation: emptyObservation(),
        diagnosis,
      }),
    ).toBe('failed');
  });
});
