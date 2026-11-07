import type { CauseId, DiagnosisConfidence, LegacyFailureClass } from './types';
import {
  failureTextImpliesRetryExhausted,
  resolveFailureText,
  type FailureTextInput,
} from './failureText';

export interface ClassifyCauseInput extends FailureTextInput {
  serverName?: string;
}

export interface ClassifyCauseResult {
  causeId: CauseId;
  confidence: DiagnosisConfidence;
  evidence: string[];
  retryExhausted: boolean;
}

/**
 * Server-name-agnostic cause classifier (ARCH §5).
 * Vendor recipes overlay after class — not here.
 */
export function classifyCause(input: ClassifyCauseInput): ClassifyCauseResult {
  const err = resolveFailureText(input);
  const name = input.serverName || '';
  const retryExhausted = failureTextImpliesRetryExhausted(input);
  const evidence: string[] = [];
  if (err) evidence.push(err.length > 200 ? `${err.slice(0, 200)}…` : err);
  if (retryExhausted) evidence.push('retryExhausted');

  if (
    /session has expired|reauthenticate|aws login|expired.*credential|credential.*expired/i.test(
      err,
    )
  ) {
    return { causeId: 'auth.expired', confidence: 'high', evidence, retryExhausted };
  }
  if (/aws/i.test(name) && /-32602/.test(err) && /invalid request parameters/i.test(err)) {
    return { causeId: 'auth.expired', confidence: 'medium', evidence, retryExhausted };
  }

  if (/no token provided|missing api key|missing.*token|provide a valid token|api key.*required/i.test(err)) {
    return { causeId: 'auth.missing', confidence: 'high', evidence, retryExhausted };
  }

  if (/www-authenticate|protected resource metadata|\bprm\b|oauth/i.test(err)) {
    return { causeId: 'auth.oauth_needed', confidence: 'medium', evidence, retryExhausted };
  }

  if (
    /auth required \(http 401\)|unauthorized|forbidden|\b401\b|\b403\b|invalid token|invalid api key/i.test(
      err,
    )
  ) {
    return { causeId: 'auth.rejected', confidence: 'high', evidence, retryExhausted };
  }

  if (/ENOENT|command not found|spawn .+ ENOENT/i.test(err)) {
    return { causeId: 'spawn.enoent', confidence: 'high', evidence, retryExhausted };
  }
  if (/-32000:\s*Connection closed|Connection closed/i.test(err)) {
    return { causeId: 'spawn.closed', confidence: 'medium', evidence, retryExhausted };
  }

  if (
    /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|fetch failed|network|sse|streamable http/i.test(err) &&
    !/token|auth|unauthorized|401/i.test(err)
  ) {
    return { causeId: 'transport.http', confidence: 'medium', evidence, retryExhausted };
  }

  return { causeId: 'generic', confidence: 'low', evidence, retryExhausted };
}

export function causeIdToLegacyFailureClass(causeId: CauseId): LegacyFailureClass {
  switch (causeId) {
    case 'auth.expired':
      return 'aws_session';
    case 'auth.missing':
    case 'auth.rejected':
    case 'auth.oauth_needed':
      return 'auth';
    case 'spawn.enoent':
    case 'spawn.closed':
      return 'spawn';
    default:
      return 'generic';
  }
}

export function legacyFailureClassToCauseId(cls: LegacyFailureClass): CauseId {
  switch (cls) {
    case 'aws_session':
      return 'auth.expired';
    case 'auth':
      return 'auth.rejected';
    case 'spawn':
      return 'spawn.enoent';
    default:
      return 'generic';
  }
}
