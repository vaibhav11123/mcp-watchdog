import type { DerivedServerState, Diagnosis, RuntimeObservation } from './types';

export interface DeriveStateInput {
  observation: RuntimeObservation;
  diagnosis?: Diagnosis;
  /** First probe still in flight. */
  connecting?: boolean;
}

/**
 * Collapse observation (+ optional diagnosis) into exactly one of five UI states.
 * Host Unknown never forces failed by itself.
 */
export function deriveServerState(input: DeriveStateInput): DerivedServerState {
  if (input.connecting) return 'connecting';

  const o = input.observation;
  if (o.process === 'exited') {
    if (o.discovery === 'success' || o.auth === 'ok') return 'degraded';
    return 'disconnected';
  }

  if (o.transport === 'disconnected') {
    if (o.discovery === 'success' || o.auth === 'ok') return 'degraded';
    return 'disconnected';
  }

  const probeFailed =
    o.discovery === 'failed' ||
    o.auth === 'missing' ||
    o.auth === 'rejected' ||
    o.auth === 'expired' ||
    o.configuration === 'invalid';

  if (probeFailed) {
    if (o.discovery === 'success' && o.execution === 'failed') return 'degraded';
    return 'failed';
  }

  if (o.execution === 'failed') return 'degraded';

  if (
    o.transport === 'connected' ||
    o.discovery === 'success' ||
    o.auth === 'ok' ||
    o.auth === 'not_required'
  ) {
    return 'healthy';
  }

  if (input.diagnosis && input.diagnosis.causeId !== 'generic') {
    return 'failed';
  }

  return 'connecting';
}
