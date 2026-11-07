import type { CauseId } from './types';

/** Plain one-sentence UI copy (CAUSE-CATALOG cause sentence map). Never raw logs. */
export function causeSentence(causeId: CauseId): string {
  switch (causeId) {
    case 'auth.missing':
      return 'Missing credential — add the token or API key name in MCP config.';
    case 'auth.rejected':
      return 'Credential rejected — check the token or sign in again.';
    case 'auth.expired':
      return 'Session expired — refresh or run login, then retry the probe.';
    case 'auth.oauth_needed':
      return 'Server wants OAuth / sign-in discovery before tools work.';
    case 'transport.http':
      return 'Network or HTTP transport failed — check URL and connectivity.';
    case 'spawn.enoent':
      return 'Command not found — fix the stdio command path or install the binary.';
    case 'spawn.closed':
      return 'Process closed the connection — check stderr and command/cwd.';
    case 'generic':
      return 'Could not classify the failure — open the log, then MCP config.';
  }
}
