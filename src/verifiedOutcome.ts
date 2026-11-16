import type { ServerStatus } from './monitor';

/**
 * S-VERIFY-01 / O4: sticky Fix verify through healthy so Overview can show
 * "Verified: resolved". Clear when a new failure starts after healthy.
 */
export function mergeVerifiedOutcome(
  prev: ServerStatus | undefined,
  next: Pick<ServerStatus, 'state' | 'verifiedOutcome'>,
): ServerStatus['verifiedOutcome'] {
  let verifiedOutcome = next.verifiedOutcome ?? prev?.verifiedOutcome;
  const leavingHealthy =
    prev?.state === 'healthy' && next.state !== 'healthy' && !next.verifiedOutcome;
  if (leavingHealthy) {
    verifiedOutcome = undefined;
  }
  return verifiedOutcome;
}
