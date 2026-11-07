import type { McpServerConfig } from './config-core';
import type { ServerStatus } from './monitor';
import {
  causeIdToLegacyFailureClass,
  diagnose,
  legacyFailureClassToCauseId,
  recommendActions,
  resolveFailureText as coreResolveFailureText,
  type CauseId,
  type Diagnosis,
  type DoctorAction,
  type LegacyFailureClass,
} from '../packages/probe-core/src/diagnostics/index';

/** @deprecated Prefer CauseId from probe-core; kept for telemetry/UI compat. */
export type FailureClass = LegacyFailureClass;

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
  return coreResolveFailureText(input);
}

export function diagnoseFailure(input: ClassifyFailureInput): Diagnosis {
  const stdioCommand = input.config?.type === 'stdio' ? input.config.command : undefined;
  return diagnose({
    serverName: input.serverName,
    lastError: input.lastError,
    lastProbeError: input.lastProbeError,
    failureContext: input.failureContext,
    awsProfileId: input.awsProfileId,
    loginUrl: input.loginUrl,
    stdioCommand,
    wave2Actions: input.wave2Actions,
  });
}

export function classifyCauseId(input: ClassifyFailureInput): CauseId {
  return diagnoseFailure(input).causeId;
}

export function classifyFailure(input: ClassifyFailureInput): FailureClass {
  return causeIdToLegacyFailureClass(diagnoseFailure(input).causeId);
}

function actionsToFixSteps(actions: DoctorAction[]): FixStep[] {
  return actions.map((a) => ({
    id: a.id as FixStepId,
    label: a.label,
    detail: a.detail,
  }));
}

export function buildFixSteps(cls: FailureClass, input: ClassifyFailureInput): FixStep[] {
  const text = resolveFailureText(input);
  if (text) {
    return actionsToFixSteps(diagnoseFailure(input).actions);
  }
  // Compat: callers may pass legacy class without error text (unit tests / empty status).
  const causeId = legacyFailureClassToCauseId(cls);
  return actionsToFixSteps(
    recommendActions({
      causeId,
      awsProfileId: input.awsProfileId,
      loginUrl: input.loginUrl,
      stdioCommand: input.config?.type === 'stdio' ? input.config.command : undefined,
      wave2Actions: input.wave2Actions,
    }),
  );
}

/**
 * HostCapabilities honesty (Phase 2 fold): do not offer editor MCP restart
 * when the host has no restart command (`canRestartServer === false`).
 */
export function filterFixStepsForHostCaps(steps: FixStep[], canRestartServer?: boolean): FixStep[] {
  if (canRestartServer !== false) return steps;
  return steps.filter((s) => s.id !== 'restart.editorMcp');
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
