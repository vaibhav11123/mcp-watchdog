import { classifyCause, type ClassifyCauseInput } from './classify';
import { recommendActions, type RecommendInput } from './recommend';
import type { Diagnosis, RuntimeObservation } from './types';

export interface DiagnoseInput extends ClassifyCauseInput {
  observation?: Partial<RuntimeObservation>;
  awsProfileId?: string;
  loginUrl?: string;
  stdioCommand?: string;
  wave2Actions?: boolean;
}

export function diagnose(input: DiagnoseInput): Diagnosis {
  const classified = classifyCause(input);
  const actions = recommendActions({
    causeId: classified.causeId,
    awsProfileId: input.awsProfileId,
    loginUrl: input.loginUrl,
    stdioCommand: input.stdioCommand,
    wave2Actions: input.wave2Actions,
  });

  const unknowns: string[] = [];
  const host = input.observation?.hostConnection ?? 'unknown';
  if (host === 'unknown') {
    unknowns.push('hostConnection unobserved — editor session health Unknown');
  }
  if (classified.causeId === 'generic') {
    unknowns.push('no narrower cause matched error text');
  }

  return {
    causeId: classified.causeId,
    confidence: classified.confidence,
    evidence: classified.evidence,
    unknowns,
    actions,
    retryExhausted: classified.retryExhausted,
  };
}

export function emptyObservation(partial?: Partial<RuntimeObservation>): RuntimeObservation {
  return {
    configuration: 'unknown',
    process: 'unknown',
    transport: 'unknown',
    protocol: 'unknown',
    discovery: 'unknown',
    auth: 'unknown',
    hostConnection: 'unknown',
    execution: 'not_tested',
    retryExhausted: false,
    observedAt: new Date().toISOString(),
    ...partial,
  };
}

/** After Fix: compare prior diagnosis intent to a fresh observation. */
export function verifyRecovery(args: {
  before: RuntimeObservation;
  after: RuntimeObservation;
}): import('./types').VerifiedOutcome {
  const afterOk =
    (args.after.discovery === 'success' || args.after.transport === 'connected') &&
    args.after.auth !== 'missing' &&
    args.after.auth !== 'rejected' &&
    args.after.auth !== 'expired' &&
    args.after.configuration !== 'invalid';

  const beforeBad =
    args.before.discovery === 'failed' ||
    args.before.auth === 'missing' ||
    args.before.auth === 'rejected' ||
    args.before.auth === 'expired' ||
    args.before.transport === 'disconnected';

  if (afterOk && beforeBad) return 'resolved';
  if (afterOk && !beforeBad) return 'resolved';

  const afterWorse =
    (args.after.discovery === 'failed' && args.before.discovery !== 'failed') ||
    (args.after.auth === 'rejected' && args.before.auth === 'missing');
  if (afterWorse) return 'worsened';

  if (
    args.after.discovery === 'unknown' &&
    args.after.transport === 'unknown' &&
    args.after.auth === 'unknown'
  ) {
    return 'unknown';
  }
  return 'unresolved';
}
