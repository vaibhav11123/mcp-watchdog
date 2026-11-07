import {
  emptyObservation,
  type CauseId,
  type RuntimeObservation,
} from '../packages/probe-core/src/diagnostics/index';
import type { ServerStatus } from './monitor';
import { diagnoseFailure } from './failureTriage';

function authFromCause(causeId: CauseId): RuntimeObservation['auth'] {
  switch (causeId) {
    case 'auth.missing':
      return 'missing';
    case 'auth.rejected':
      return 'rejected';
    case 'auth.expired':
      return 'expired';
    case 'auth.oauth_needed':
      return 'missing';
    default:
      return 'unknown';
  }
}

/** Map monitor status → RuntimeObservation for verifyRecovery (host always Unknown). */
export function observationFromStatus(status: ServerStatus): RuntimeObservation {
  const hostConnection = 'unknown' as const;
  if (status.state === 'healthy') {
    return emptyObservation({
      discovery: 'success',
      transport: 'connected',
      auth: 'ok',
      process: 'running',
      hostConnection,
      execution: 'successful',
    });
  }
  if (status.state === 'connecting') {
    return emptyObservation({ hostConnection });
  }
  if (status.state === 'disconnected') {
    return emptyObservation({
      process: 'exited',
      transport: 'disconnected',
      hostConnection,
    });
  }

  const causeId = diagnoseFailure({
    serverName: status.name,
    lastError: status.lastError,
    lastProbeError: status.lastProbeError,
    failureContext: status.failureContext,
  }).causeId;

  if (status.state === 'degraded') {
    return emptyObservation({
      discovery: 'success',
      transport: 'connected',
      auth: causeId.startsWith('auth.') ? authFromCause(causeId) : 'ok',
      execution: 'failed',
      hostConnection,
    });
  }

  // failed
  if (causeId.startsWith('auth.')) {
    return emptyObservation({
      discovery: 'failed',
      transport: 'disconnected',
      auth: authFromCause(causeId),
      hostConnection,
    });
  }
  if (causeId === 'transport.http') {
    return emptyObservation({
      discovery: 'failed',
      transport: 'disconnected',
      hostConnection,
    });
  }
  if (causeId.startsWith('spawn.')) {
    return emptyObservation({
      process: 'exited',
      transport: 'disconnected',
      discovery: 'failed',
      hostConnection,
    });
  }
  return emptyObservation({
    discovery: 'failed',
    transport: 'disconnected',
    hostConnection,
  });
}
