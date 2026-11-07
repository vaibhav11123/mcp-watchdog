import { describe, expect, it } from 'vitest';
import {
  DoctorMetrics,
  appendIncidentRecord,
  redactEvidenceSummary,
} from '../../src/incidentStore';
import { emptyObservation } from '../../packages/probe-core/src/diagnostics/index';

describe('incidentStore', () => {
  it('redacts bearer-like evidence before persist', () => {
    expect(redactEvidenceSummary('Authorization: Bearer abcdefghijklmnop')).toMatch(/\[redacted\]/);
  });

  it('appends jsonl via writeFile hook', () => {
    const lines: string[] = [];
    const rec = appendIncidentRecord({
      workspaceRoot: '/tmp/ws',
      serverName: 'echo',
      hostId: 'cursor',
      transport: 'stdio',
      causeId: 'auth.missing',
      evidenceSummary: 'No token provided',
      observation: emptyObservation({ auth: 'missing', discovery: 'failed' }),
      actionsAttempted: [{ actionId: 'retry.probe', at: '2026-01-01T00:00:00.000Z' }],
      verifiedOutcome: 'unresolved',
      now: () => new Date('2026-01-01T00:00:00.000Z'),
      writeFile: (_p, line) => lines.push(line),
    });
    expect(rec?.verifiedOutcome).toBe('unresolved');
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!.trim()) as { causeId: string; hostId: string };
    expect(parsed.causeId).toBe('auth.missing');
    expect(parsed.hostId).toBe('cursor');
  });

  it('DoctorMetrics tracks verified-resolve rate', () => {
    const m = new DoctorMetrics();
    m.recordDiagnose();
    m.recordVerify('resolved');
    m.recordVerify('unresolved');
    expect(m.verifiedResolveRate()).toBe(0.5);
  });
});
