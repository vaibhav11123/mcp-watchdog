/**
 * Classify probe/connect error messages for display.
 * Auth-related failures stay in failed/degraded — no new ServerState.
 */
export function classifyProbeError(message: string): string {
  if (isAuthRequiredError(message)) {
    return 'Auth required (HTTP 401)';
  }
  return message;
}

/** True when the error text suggests HTTP 401 / Unauthorized / WWW-Authenticate. */
export function isAuthRequiredError(message: string): boolean {
  return /401|unauthorized|www-authenticate/i.test(message);
}
