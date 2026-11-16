import { describe, expect, it } from 'vitest';
import {
  causeIdToLegacyFailureClass,
  diagnose,
  emptyObservation,
  verifyRecovery,
} from '../../packages/probe-core/src/diagnostics/index';
import { classifyCauseId, classifyFailure } from '../../src/failureTriage';

describe('diagnose / auth taxonomy', () => {
  it('posthog and acme “No token provided” → same auth.missing', () => {
    const msg = 'No token provided. Please provide a valid token.';
    expect(diagnose({ serverName: 'posthog', lastError: msg }).causeId).toBe('auth.missing');
    expect(diagnose({ serverName: 'acme', lastError: msg }).causeId).toBe('auth.missing');
    expect(classifyFailure({ serverName: 'posthog', lastError: msg })).toBe('auth');
  });

  it('401 / unauthorized → auth.rejected', () => {
    expect(diagnose({ serverName: 'remote', lastError: 'Auth required (HTTP 401)' }).causeId).toBe(
      'auth.rejected',
    );
  });

  it('session expired → auth.expired (legacy aws_session)', () => {
    const d = diagnose({ serverName: 'x', lastError: 'Your session has expired' });
    expect(d.causeId).toBe('auth.expired');
    expect(causeIdToLegacyFailureClass(d.causeId)).toBe('aws_session');
  });

  it('max retries peels to underlying auth.missing + retryExhausted', () => {
    const d = diagnose({
      serverName: 'svc',
      lastError: 'Max retries exceeded',
      lastProbeError: 'No token provided',
      failureContext: 'Max retries exceeded\n[svc] Probe failed: No token provided',
    });
    expect(d.causeId).toBe('auth.missing');
    expect(d.retryExhausted).toBe(true);
  });

  it('ENOENT → spawn.enoent', () => {
    expect(classifyCauseId({ serverName: 'bad', lastError: 'spawn npx ENOENT' })).toBe(
      'spawn.enoent',
    );
  });

  it('C-AUTH-OAUTH-01: www-authenticate / oauth → auth.oauth_needed', () => {
    expect(
      diagnose({ serverName: 'remote', lastError: 'WWW-Authenticate: Bearer realm=prm' }).causeId,
    ).toBe('auth.oauth_needed');
  });

  it('C-TRANSPORT-HTTP-01: ECONNREFUSED → transport.http', () => {
    expect(diagnose({ serverName: 'http', lastError: 'fetch failed: ECONNREFUSED' }).causeId).toBe(
      'transport.http',
    );
  });

  it('C-SPAWN-CLOSED-01: Connection closed → spawn.closed', () => {
    expect(diagnose({ serverName: 'stdio', lastError: '-32000: Connection closed' }).causeId).toBe(
      'spawn.closed',
    );
  });

  it('C-SPAWN-CLOSED-02: bare Max retries exceeded → spawn.closed (not generic)', () => {
    const d = diagnose({ serverName: 'echo', lastError: 'Max retries exceeded' });
    expect(d.causeId).toBe('spawn.closed');
    expect(d.retryExhausted).toBe(true);
  });

  it('C-TRANSPORT-TIMEOUT-01: -32001 Request timed out beats retryExhausted → spawn.closed', () => {
    for (const serverName of ['stdio-echo', 'http-remote', 'sse-feed']) {
      const d = diagnose({
        serverName,
        lastError: 'Max retries exceeded',
        lastProbeError: 'MCP error -32001: Request timed out',
        wave2Actions: true,
      });
      expect(d.causeId).toBe('transport.timeout');
      expect(d.retryExhausted).toBe(true);
      expect(d.actions.map((a) => a.id)).toEqual(['show.log', 'open.config', 'retry.probe']);
      expect(d.actions.map((a) => a.label)).toEqual(['Show Log', 'Open MCP Config', 'Retry probe']);
      expect(d.actions.every((a) => !/crash|stderr|command -v/i.test(a.label))).toBe(true);
    }
  });

  it('C-TRANSPORT-TIMEOUT-02: ETIMEDOUT stays transport.http', () => {
    expect(
      diagnose({ serverName: 'http', lastError: 'connect ETIMEDOUT 1.2.3.4:443' }).causeId,
    ).toBe('transport.http');
  });

  it('C-TRANSPORT-TIMEOUT-03: bare -32001 Session not found is not timeout', () => {
    expect(
      diagnose({ serverName: 'x', lastError: 'MCP error -32001: Session not found' }).causeId,
    ).not.toBe('transport.timeout');
  });

  it('C-GENERIC-01: opaque text → generic', () => {
    expect(diagnose({ serverName: 'x', lastError: 'something weird happened' }).causeId).toBe(
      'generic',
    );
  });

  it('S-FIX-QP-01: auth.expired recommend list stays full (not toast-capped)', () => {
    const d = diagnose({
      serverName: 'aws',
      lastError: 'Your session has expired',
      awsProfileId: 'dev',
      wave2Actions: true,
    });
    expect(d.actions.length).toBeGreaterThan(3);
    expect(d.actions.some((a) => a.id === 'retry.probe')).toBe(true);
    expect(d.actions.some((a) => a.id === 'terminal.awsLogin' || a.id === 'copy.command')).toBe(
      true,
    );
  });
});

describe('verifyRecovery', () => {
  it('marks resolved when after discovery succeeds', () => {
    const before = emptyObservation({ discovery: 'failed', auth: 'missing' });
    const after = emptyObservation({
      discovery: 'success',
      transport: 'connected',
      auth: 'ok',
      execution: 'successful',
    });
    expect(verifyRecovery({ before, after })).toBe('resolved');
  });

  it('never resolves when after is degraded (execution failed)', () => {
    const before = emptyObservation({ discovery: 'failed', transport: 'disconnected' });
    const after = emptyObservation({
      discovery: 'success',
      transport: 'connected',
      auth: 'ok',
      execution: 'failed',
    });
    expect(verifyRecovery({ before, after })).toBe('unresolved');
  });

  it('marks unresolved when still failing', () => {
    const before = emptyObservation({ discovery: 'failed', auth: 'missing' });
    const after = emptyObservation({ discovery: 'failed', auth: 'missing' });
    expect(verifyRecovery({ before, after })).toBe('unresolved');
  });

  it('C-VERIFY-WORSENED-01: discovery newly failed → worsened', () => {
    const before = emptyObservation({ discovery: 'success', auth: 'ok', transport: 'connected' });
    const after = emptyObservation({ discovery: 'failed', auth: 'rejected' });
    expect(verifyRecovery({ before, after })).toBe('worsened');
  });

  it('C-VERIFY-UNKNOWN-01: after all unknown → unknown', () => {
    const before = emptyObservation({ discovery: 'failed', auth: 'missing' });
    const after = emptyObservation({
      discovery: 'unknown',
      transport: 'unknown',
      auth: 'unknown',
    });
    expect(verifyRecovery({ before, after })).toBe('unknown');
  });
});
