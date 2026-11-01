/** In-memory store for self-host MVP without Postgres. */

export interface WatchedServer {
  id: string;
  name: string;
  url: string;
  lastState?: string;
  lastHash?: string;
  lastError?: string;
}

export interface DualTruthRow {
  id: string;
  workspaceIdHash: string;
  serverName: string;
  ide_state: string;
  cloud_probe_state: string | null;
  at: string;
  accepted?: boolean;
}

export interface AuditEvent {
  id: number;
  action: string;
  detail: string;
  at: string;
}

export const servers = new Map<string, WatchedServer>();
export const bridgeIncidents: DualTruthRow[] = [];
export const auditLog: AuditEvent[] = [];
export const diffs: { serverId: string; severity: string; detail: string; at: string }[] = [];

let auditSeq = 1;

export function appendAudit(action: string, detail: string): void {
  auditLog.push({
    id: auditSeq++,
    action,
    detail,
    at: new Date().toISOString(),
  });
}
