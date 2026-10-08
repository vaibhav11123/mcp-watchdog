import { describe, expect, it } from 'vitest';
import { IncidentRingBuffer } from '../../src/incidents';

describe('IncidentRingBuffer', () => {
  it('records transitions and drops when over capacity', () => {
    const buf = new IncidentRingBuffer(3);
    buf.record({ ts: 1, server: 'a', from: 'healthy', to: 'degraded' });
    buf.record({ ts: 2, server: 'a', from: 'degraded', to: 'failed' });
    buf.record({ ts: 3, server: 'b', from: 'connecting', to: 'healthy' });
    buf.record({ ts: 4, server: 'b', from: 'healthy', to: 'disconnected' });
    expect(buf.size).toBe(3);
    expect(buf.getAll().map((t) => t.ts)).toEqual([2, 3, 4]);
  });

  it('recordChange skips same-state and undefined from', () => {
    const buf = new IncidentRingBuffer();
    buf.recordChange('x', undefined, 'connecting');
    buf.recordChange('x', 'connecting', 'connecting');
    buf.recordChange('x', 'connecting', 'healthy');
    expect(buf.size).toBe(1);
    expect(buf.getAll()[0]).toMatchObject({
      server: 'x',
      from: 'connecting',
      to: 'healthy',
    });
  });

  it('includes lastError on failure transitions', () => {
    const buf = new IncidentRingBuffer();
    buf.recordChange('srv', 'healthy', 'degraded', 'Auth required (HTTP 401)', 1000);
    expect(buf.getAll()[0].lastError).toBe('Auth required (HTTP 401)');
  });

  it('exportToMarkdown renders a table', () => {
    const buf = new IncidentRingBuffer();
    buf.record({
      ts: Date.UTC(2026, 0, 2, 12, 0, 0),
      server: 'memory',
      from: 'healthy',
      to: 'failed',
      lastError: 'boom | pipe',
    });
    const md = buf.exportToMarkdown();
    expect(md).toContain('# MCP Watchdog incidents');
    expect(md).toContain('| Time (UTC) | Server | From | To | Error |');
    expect(md).toContain('memory');
    expect(md).toContain('healthy');
    expect(md).toContain('failed');
    expect(md).toContain('boom \\| pipe');
  });

  it('exportToMarkdown handles empty buffer', () => {
    const buf = new IncidentRingBuffer();
    expect(buf.exportToMarkdown()).toContain('No state transitions');
  });
});
