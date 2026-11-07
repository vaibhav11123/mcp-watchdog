import type { FailureClass, FixStepId } from '../failureTriage';
import type { CauseId } from '../../packages/probe-core/src/diagnostics/index';
import type { ServerState } from '../monitor';
import type { ProbeMode } from '../options';

export type TelemetryEventName =
  | 'activation'
  | 'state_transition'
  | 'triage_action'
  | 'trust_decision'
  | 'settings_change'
  | 'error'
  | 'ui_command';

export type TriageAction =
  | 'accept'
  | 'fix_step'
  | 'remove'
  | 'retry'
  | 'restart_editor_mcp'
  | 'mute';

export type TriageSurface = 'toast' | 'tree' | 'overview' | 'command' | 'quickpick' | 'unknown';

export type TrustOutcome = 'allowed' | 'revoked' | 'deferred';

export type SettingsKey = 'telemetry.enabled' | 'cloudBridge.enabled';

export type TransportKind = 'stdio' | 'http' | 'sse' | 'unknown';

export type ProbeModeSnapshot = ProbeMode | 'mixed' | 'none';

export type UiCommandName =
  | 'showStatus'
  | 'reconnectAll'
  | 'reconnectServer'
  | 'focusServersView'
  | 'openMcpConfig'
  | 'showOutput'
  | 'refresh'
  | 'reviewTrust'
  | 'exportIncident'
  | 'acceptFailure'
  | 'fixFailure'
  | 'removeServer'
  | 'clearAcceptance'
  | 'starOnGitHub';

export type StarMethod =
  | 'gh_api'
  | 'browser'
  | 'already'
  | 'silent_gh'
  | 'silent_already'
  | 'silent_skipped';

export interface ActivationProps {
  extVersion: string;
  editor: string;
  vscodeVersion: string;
  /** Merged mcp.json server count (configured). */
  serverCount: number;
  /** Servers with an active monitor. */
  monitoringCount: number;
  probeMode: ProbeModeSnapshot;
  cloudBridgeEnabled: boolean;
  authProbeEnabledCount: number;
  $set?: Record<string, string | number | boolean>;
  $set_once?: Record<string, string | number | boolean>;
}

export interface StateTransitionProps {
  transport: TransportKind;
  stateFrom: ServerState;
  stateTo: ServerState;
  /** @deprecated prefer causeId; kept for one-minor compat. */
  failureClass?: FailureClass;
  causeId?: CauseId;
}

export interface TriageActionProps {
  action: TriageAction;
  surface: TriageSurface;
  fixStepId?: FixStepId | string;
  /** @deprecated prefer causeId; kept for one-minor compat. */
  failureClass?: FailureClass;
  causeId?: CauseId;
}

export interface TrustDecisionProps {
  outcome: TrustOutcome;
  allowedCount: number;
}

export interface SettingsChangeProps {
  key: SettingsKey;
  value: boolean;
}

export interface ErrorProps {
  where: string;
  name: string;
}

export interface UiCommandProps {
  command: UiCommandName;
  method?: StarMethod;
}

export type EventPropsMap = {
  activation: ActivationProps;
  state_transition: StateTransitionProps;
  triage_action: TriageActionProps;
  trust_decision: TrustDecisionProps;
  settings_change: SettingsChangeProps;
  error: ErrorProps;
  ui_command: UiCommandProps;
};
