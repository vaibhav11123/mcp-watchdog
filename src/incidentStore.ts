/**
 * Phase 3: durable IncidentRecord append (.mcp-watchdog/incidents.jsonl).
 * vscode-free file IO — extension supplies workspace root.
 */
import * as fs from 'fs';
import * as path from 'path';
import { redactSecrets } from './secretRedact';
import type {
  CauseId,
  RuntimeObservation,
  VerifiedOutcome,
} from '../packages/probe-core/src/diagnostics/index';
import type { HostId } from './hostCapabilities';

export interface IncidentRecord {
  id: string;
  serverName: string;
  hostId: HostId;
  hostVersion?: string;
  transport: 'stdio' | 'http' | 'sse' | 'unknown';
  causeId: CauseId;
  evidenceSummary: string;
  observation: RuntimeObservation;
  actionsAttempted: { actionId: string; at: string }[];
  verifiedOutcome: VerifiedOutcome;
  verifiedAt?: string;
  createdAt: string;
}

export interface AppendIncidentInput {
  workspaceRoot: string | undefined;
  serverName: string;
  hostId: HostId;
  hostVersion?: string;
  transport: IncidentRecord['transport'];
  causeId: CauseId;
  evidenceSummary: string;
  observation: RuntimeObservation;
  actionsAttempted: { actionId: string; at: string }[];
  verifiedOutcome: VerifiedOutcome;
  now?: () => Date;
  /** Injected for unit tests. */
  writeFile?: (filePath: string, line: string) => void;
}

export function incidentsDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.mcp-watchdog');
}

export function incidentsJsonlPath(workspaceRoot: string): string {
  return path.join(incidentsDir(workspaceRoot), 'incidents.jsonl');
}

/** Redact accidental secrets from free-text evidence before persist. */
export function redactEvidenceSummary(text: string): string {
  return redactSecrets(text).slice(0, 500);
}

function defaultWrite(filePath: string, line: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(filePath, line, 'utf8');
}

/**
 * Append one IncidentRecord. Returns the record, or undefined if no writable workspace.
 * Never writes env/header values — evidence is redacted cause text only.
 */
export function appendIncidentRecord(input: AppendIncidentInput): IncidentRecord | undefined {
  const now = input.now ?? (() => new Date());
  const createdAt = now().toISOString();
  const record: IncidentRecord = {
    id: `inc_${createdAt.replace(/[:.]/g, '-')}_${input.serverName.replace(/[^\w.-]/g, '_')}`,
    serverName: input.serverName,
    hostId: input.hostId,
    ...(input.hostVersion ? { hostVersion: input.hostVersion } : {}),
    transport: input.transport,
    causeId: input.causeId,
    evidenceSummary: redactEvidenceSummary(input.evidenceSummary),
    observation: input.observation,
    actionsAttempted: input.actionsAttempted,
    verifiedOutcome: input.verifiedOutcome,
    verifiedAt: createdAt,
    createdAt,
  };

  if (!input.workspaceRoot) return record;

  try {
    const filePath = incidentsJsonlPath(input.workspaceRoot);
    const write = input.writeFile ?? defaultWrite;
    write(filePath, `${JSON.stringify(record)}\n`);
  } catch {
    // Fallback: return in-memory record only (ARCH: ring if unwritable).
  }
  return record;
}

/** Simple in-process counters for diagnose% / verified-resolve% thesis hooks. */
export class DoctorMetrics {
  diagnoses = 0;
  verifies = 0;
  verifiedResolved = 0;

  recordDiagnose(): void {
    this.diagnoses += 1;
  }

  recordVerify(outcome: VerifiedOutcome): void {
    this.verifies += 1;
    if (outcome === 'resolved') this.verifiedResolved += 1;
  }

  diagnoseRate(totalFailures: number): number {
    if (totalFailures <= 0) return 0;
    return this.diagnoses / totalFailures;
  }

  verifiedResolveRate(): number {
    if (this.verifies <= 0) return 0;
    return this.verifiedResolved / this.verifies;
  }
}
