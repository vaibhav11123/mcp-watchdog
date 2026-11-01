/**
 * Classify probe/connect error messages for display.
 * Auth-related failures stay in failed/degraded — no new ServerState.
 */
export function classifyProbeError(message: string): string {
  if (isAuthRequiredError(message)) {
    return 'Auth required (HTTP 401)';
  }
  if (isAwsSessionExpiredError(message)) {
    return 'AWS credentials expired — run: aws login --profile <profile>';
  }
  return message;
}

/** True when the error text suggests HTTP 401 / Unauthorized / WWW-Authenticate. */
export function isAuthRequiredError(message: string): boolean {
  return /401|unauthorized|www-authenticate/i.test(message);
}

/**
 * AWS CLI / proxy messages that clearly mean the local session expired.
 * Do not rewrite bare MCP -32602 (too many unrelated servers share that code).
 */
export function isAwsSessionExpiredError(message: string): boolean {
  return /session has expired|reauthenticate|aws login|expired.*credential|credential.*expired/i.test(
    message,
  );
}
