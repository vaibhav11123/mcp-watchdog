import type { CauseId, DoctorAction } from './types';

export interface RecommendInput {
  causeId: CauseId;
  /** Profile id for AWS login copy only — never other secrets. */
  awsProfileId?: string;
  loginUrl?: string;
  stdioCommand?: string;
  wave2Actions?: boolean;
}

export function recommendActions(input: RecommendInput): DoctorAction[] {
  const wave2 = input.wave2Actions === true;
  const profile = input.awsProfileId?.trim() || '<profile>';

  switch (input.causeId) {
    case 'auth.expired': {
      const login = `aws login --profile ${profile}`;
      return [
        {
          id: wave2 ? 'terminal.awsLogin' : 'copy.command',
          label: wave2 ? `Run in terminal: ${login}` : `Copy: ${login}`,
          detail: login,
        },
        { id: 'copy.command', label: 'Copy aws login command', detail: login },
        {
          id: 'copy.command',
          label: 'Region tip (if still failing)',
          detail: `aws configure set region <region> --profile ${profile}`,
        },
        { id: 'retry.probe', label: 'Retry probe (after login)' },
        { id: 'restart.editorMcp', label: 'Restart editor MCP (if available)' },
      ];
    }
    case 'auth.missing':
    case 'auth.rejected':
    case 'auth.oauth_needed': {
      const steps: DoctorAction[] = [
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
        if (input.causeId === 'auth.oauth_needed') {
          steps.push({ id: 'openExternal.prm', label: 'Try OAuth / sign-in discovery' });
        }
        steps.push({ id: 'credential.wizard', label: 'Enter API key / credential…' });
      }
      steps.push({ id: 'retry.probe', label: 'Retry probe' });
      return steps;
    }
    case 'spawn.enoent':
    case 'spawn.closed': {
      const steps: DoctorAction[] = [
        { id: 'show.log', label: 'Show Log (crash often only on stderr)' },
        { id: 'open.config', label: 'Open MCP Config (command / path / cwd)' },
      ];
      const cmd = input.stdioCommand;
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
    case 'transport.http':
      return [
        { id: 'show.log', label: 'Show Log' },
        { id: 'open.config', label: 'Open MCP Config (URL / network)' },
        { id: 'retry.probe', label: 'Retry probe' },
      ];
    default:
      return [
        { id: 'retry.probe', label: 'Retry probe' },
        { id: 'restart.editorMcp', label: 'Restart editor MCP (if available)' },
        { id: 'show.log', label: 'Show Log' },
        { id: 'open.config', label: 'Open MCP Config' },
        { id: 'reload.window', label: 'Reload Window' },
      ];
  }
}
