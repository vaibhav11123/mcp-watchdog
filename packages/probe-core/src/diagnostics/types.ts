/** Multi-dimension probe + host snapshot (ARCH §4). */
export interface RuntimeObservation {
  configuration: 'valid' | 'invalid' | 'unknown';
  process: 'running' | 'exited' | 'not_applicable' | 'unknown';
  transport: 'connected' | 'disconnected' | 'unknown';
  protocol: 'compatible' | 'incompatible' | 'unknown';
  discovery: 'success' | 'failed' | 'unknown';
  auth: 'not_required' | 'ok' | 'missing' | 'rejected' | 'expired' | 'unknown';
  hostConnection: 'connected' | 'disconnected' | 'unknown';
  execution: 'successful' | 'failed' | 'not_tested';
  retryExhausted: boolean;
  observedAt: string;
}

export type CauseId =
  | 'auth.missing'
  | 'auth.rejected'
  | 'auth.expired'
  | 'auth.oauth_needed'
  | 'transport.http'
  | 'spawn.enoent'
  | 'spawn.closed'
  | 'generic';

export type DiagnosisConfidence = 'high' | 'medium' | 'low';

/** Aligned with extension FixStepId strings. */
export type DoctorActionId =
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

export interface DoctorAction {
  id: DoctorActionId;
  label: string;
  detail?: string;
}

export interface Diagnosis {
  causeId: CauseId;
  confidence: DiagnosisConfidence;
  evidence: string[];
  unknowns: string[];
  actions: DoctorAction[];
  /** True when max-retries noise was peeled; never a root cause alone. */
  retryExhausted: boolean;
}

export type VerifiedOutcome = 'resolved' | 'unresolved' | 'unknown' | 'worsened';

/** Five UI states only — never invent a sixth for auth. */
export type DerivedServerState =
  | 'connecting'
  | 'healthy'
  | 'degraded'
  | 'failed'
  | 'disconnected';

/** Legacy telemetry / UI enum — shim only. */
export type LegacyFailureClass = 'aws_session' | 'auth' | 'spawn' | 'generic';
