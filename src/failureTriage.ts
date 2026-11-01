import type { McpServerConfig } from './config-core';
import type { ServerStatus } from './monitor';

export type FailureClass = 'aws_session' | 'auth' | 'spawn' | 'generic';

export type FixStepId =
  | 'copy.command'
  | 'open.config'
  | 'retry.probe'
  | 'restart.editorMcp'
  | 'reload.window'
  | 'show.log'
  | 'terminal.awsLogin'
  | 'openExternal.login'
  | 'openExternal.prm'
  | 'credential.wizard';

export interface FixStep {
  id: FixStepId;
  label: string;
  detail?: string;
}

export interface ClassifyFailureInput {
  serverName: string;
  lastError?: string;
  lastProbeError?: string;
  failureContext?: string;
  config?: McpServerConfig;
  /** Profile id for aws_session Fix copy (never other env values). */
  awsProfileId?: string;
  /** Optional login URL from vendor recipe. */
  loginUrl?: string;
  /** Wave 2+: include terminal/openExternal/wizard steps. */
  wave2Actions?: boolean;
}

const ACCEPTED_STATE_KEY = 'mcpWatchdog.acceptedFailures';

export function acceptedFailuresStorageKey(): string {
  return ACCEPTED_STATE_KEY;
}

/** Prefer lastProbeError, then scrape failureContext, else lastError. */
export function resolveFailureText(input: ClassifyFailureInput): string {
  if (input.lastProbeError?.trim()) return input.lastProbeError.trim();
  if (input.failureContext) {
    const lines = input.failureContext
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]!;
      if (/Max retries exceeded/i.test(line)) continue;
      // Strip "[name] Probe failed: " prefixes from monitor logs
      const stripped = line.replace(
        /^\[.*?\]\s*(Probe failed|Connection failed|Ping failed):\s*/i,
        '',
      );
      if (stripped.length > 0) return stripped;
    }
  }
  return input.lastError?.trim() ?? '';
}

export function classifyFailure(input: ClassifyFailureInput): FailureClass {
  const err = resolveFailureText(input);
  const name = input.serverName || '';

  if (
    /session has expired|reauthenticate|aws login|expired.*credential|credential.*expired/i.test(
      err,
    )
  ) {
    return 'aws_session';
  }
  if (/aws/i.test(name) && /-32602/.test(err) && /invalid request parameters/i.test(err)) {
    return 'aws_session';
  }
  if (/auth required \(http 401\)|unauthorized|www-authenticate|\b401\b/i.test(err)) {
    return 'auth';
  }
  if (
    /ENOENT|command not found|spawn .+ ENOENT|-32000:\s*Connection closed|Connection closed/i.test(
      err,
    )
  ) {
    return 'spawn';
  }
  return 'generic';
}

export function buildFixSteps(cls: FailureClass, input: ClassifyFailureInput): FixStep[] {
  const wave2 = input.wave2Actions === true;
  const profile = input.awsProfileId?.trim() || '<profile>';
  const cmd = input.config?.type === 'stdio' ? input.config.command : undefined;

  switch (cls) {
    case 'aws_session': {
      const login = `aws login --profile ${profile}`;
      const steps: FixStep[] = [
        {
          id: wave2 ? 'terminal.awsLogin' : 'copy.command',
          label: wave2 ? `Run in terminal: ${login}` : `Copy: ${login}`,
          detail: login,
        },
        {
          id: 'copy.command',
          label: 'Copy aws login command',
          detail: login,
        },
        {
          id: 'copy.command',
          label: 'Region tip (if still failing)',
          detail: `aws configure set region <region> --profile ${profile}`,
        },
        { id: 'retry.probe', label: 'Retry probe (after login)' },
        { id: 'restart.editorMcp', label: 'Restart editor MCP (if available)' },
      ];
      return steps;
    }
    case 'auth': {
      const steps: FixStep[] = [
        { id: 'show.log', label: 'Show Log' },
        { id: 'open.config', label: 'Open MCP Config (check header/token names only)' },
      ];
      if (wave2 && input.loginUrl) {
        steps.push({
          id: 'openExternal.login',
          label: 'Open sign-in URL',
          detail: input.loginUrl,
        });
        steps.push({ id: 'credential.wizard', label: 'Enter API key / credential…' });
      } else if (wave2) {
        steps.push({ id: 'openExternal.prm', label: 'Try OAuth / sign-in discovery' });
        steps.push({ id: 'credential.wizard', label: 'Enter API key / credential…' });
      }
      steps.push({ id: 'retry.probe', label: 'Retry probe' });
      return steps;
    }
    case 'spawn': {
      const steps: FixStep[] = [
        { id: 'show.log', label: 'Show Log (crash often only on stderr)' },
        { id: 'open.config', label: 'Open MCP Config (command / path / cwd)' },
      ];
      if (cmd) {
        steps.push({
          id: 'copy.command',
          label: `Copy: command -v ${cmd}`,
          detail: `command -v ${cmd}`,
        });
      }
      steps.push({ id: 'retry.probe', label: 'Retry probe' });
      return steps;
    }
    default: {
      return [
        { id: 'retry.probe', label: 'Retry probe' },
        { id: 'restart.editorMcp', label: 'Restart editor MCP (if available)' },
        { id: 'show.log', label: 'Show Log' },
        { id: 'open.config', label: 'Open MCP Config' },
        { id: 'reload.window', label: 'Reload Window' },
      ];
    }
  }
}

/** Drop accepted-failed servers from the chip status list (N/M). */
export function statusesForChip(
  statuses: ServerStatus[],
  acceptedNames: ReadonlySet<string> | readonly string[],
): ServerStatus[] {
  const set = acceptedNames instanceof Set ? acceptedNames : new Set(acceptedNames);
  return statuses.filter((s) => !(s.state === 'failed' && set.has(s.name)));
}

export function shouldSuppressAlert(
  name: string,
  acceptedNames: ReadonlySet<string> | readonly string[],
): boolean {
  const set = acceptedNames instanceof Set ? acceptedNames : new Set(acceptedNames);
  return set.has(name);
}

export function normalizeAcceptedList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((x): x is string => typeof x === 'string' && x.length > 0))];
}
