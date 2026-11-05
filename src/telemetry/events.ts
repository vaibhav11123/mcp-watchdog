import type { FailureClass } from '../failureTriage';
import type { ServerState } from '../monitor';

export type TelemetryEventName =
  | 'activation'
  | 'state_transition'
  | 'triage_action'
  | 'trust_decision'
  | 'settings_change'
  | 'error';

export type TriageAction =
  | 'accept'
  | 'fix_step'
  | 'remove'
  | 'retry'
  | 'restart_editor_mcp'
  | 'mute';

export type TrustOutcome = 'allowed' | 'revoked' | 'deferred';

export type SettingsKey = 'telemetry.enabled' | 'cloudBridge.enabled';

export type TransportKind = 'stdio' | 'http' | 'sse' | 'unknown';

/** Allowlisted property bag after scrub — string/number/boolean only. */
export type TelemetryProps = Record<string, string | number | boolean>;

export interface ActivationProps {
  extVersion: string;
  editor: string;
  vscodeVersion: string;
  serverCount: number;
  /** Person props for PostHog Retention / WAU (not stored on the event row). */
  $set?: Record<string, string | number | boolean>;
  $set_once?: Record<string, string | number | boolean>;
}

export interface StateTransitionProps {
  transport: TransportKind;
  stateFrom: ServerState;
  stateTo: ServerState;
  failureClass?: FailureClass;
}

export interface TriageActionProps {
  action: TriageAction;
  fixStepId?: string;
  failureClass?: FailureClass;
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

export type EventPropsMap = {
  activation: ActivationProps;
  state_transition: StateTransitionProps;
  triage_action: TriageActionProps;
  trust_decision: TrustDecisionProps;
  settings_change: SettingsChangeProps;
  error: ErrorProps;
};
