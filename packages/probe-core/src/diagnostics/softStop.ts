/**
 * Phase 5 scaffold — soft-stop / contract warning (ARCH §11).
 * Warn while probe may still be healthy; never rewrites mcp.json.
 * Full contracts/ + evidence/ extraction stays later; this is the UI-facing shape.
 */

export type ContractStatus = 'ok' | 'warn' | 'unknown';

export interface SoftStopSignal {
  contractStatus: ContractStatus;
  /** Operator-facing sentence; never includes secret values. */
  message?: string;
}

/** Pure helper: map optional contract fingerprint drift → soft-stop signal. */
export function softStopFromToolDrift(toolDrift: boolean | undefined): SoftStopSignal {
  if (toolDrift === true) {
    return {
      contractStatus: 'warn',
      message: 'Tool list changed since last probe (advisory — server may still be healthy).',
    };
  }
  if (toolDrift === false) {
    return { contractStatus: 'ok' };
  }
  return { contractStatus: 'unknown' };
}
