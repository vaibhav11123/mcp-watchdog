/** Policy / trust plane — allowlist eval (not a proxy gateway). */

export interface PolicyRule {
  id: string;
  /** Deny unpinned npx -y pattern when true. */
  denyUnpinnedNpxY?: boolean;
  allowedCommands?: string[];
  allowedUrlHosts?: string[];
}

export interface PolicySubject {
  command?: string;
  args?: string[];
  urlHost?: string;
}

export interface PolicyDecision {
  allow: boolean;
  reason: string;
}

export function evaluatePolicy(rule: PolicyRule, subject: PolicySubject): PolicyDecision {
  if (rule.denyUnpinnedNpxY) {
    const cmd = subject.command ?? '';
    const args = subject.args ?? [];
    if (cmd === 'npx' && args.includes('-y')) {
      return { allow: false, reason: 'denied unpinned npx -y' };
    }
  }
  if (rule.allowedCommands?.length && subject.command) {
    if (!rule.allowedCommands.includes(subject.command)) {
      return { allow: false, reason: `command not allowlisted: ${subject.command}` };
    }
  }
  if (rule.allowedUrlHosts?.length && subject.urlHost) {
    if (!rule.allowedUrlHosts.includes(subject.urlHost)) {
      return { allow: false, reason: `host not allowlisted: ${subject.urlHost}` };
    }
  }
  return { allow: true, reason: 'ok' };
}
