import {
  emptyObservation,
  verifyRecovery as coreVerify,
  type RuntimeObservation,
  type VerifiedOutcome,
} from '../packages/probe-core/src/diagnostics/index';

/** Phase 1: in-memory verify after Fix — durable IncidentRecord is Phase 3. */
export function verifyAfterFix(args: {
  before?: Partial<RuntimeObservation>;
  after: Partial<RuntimeObservation>;
}): VerifiedOutcome {
  const before = emptyObservation({
    discovery: 'failed',
    transport: 'disconnected',
    ...args.before,
  });
  const after = emptyObservation(args.after);
  return coreVerify({ before, after });
}

export type { RuntimeObservation, VerifiedOutcome };
