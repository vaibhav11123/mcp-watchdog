import { describe, expect, it } from 'vitest';
import { buildStatusBarModel } from '../../src/ui/statusBarModel';
import type { ServerStatus } from '../../src/monitor';

const healthy = (name = 'echo'): ServerStatus => ({
  name,
  state: 'healthy',
  retryCount: 0,
  lastPingMs: 12,
});

describe('buildStatusBarModel', () => {
  it('shows healthy count and reachability disclaimer', () => {
    const m = buildStatusBarModel([healthy()]);
    expect(m.text).toContain('Watchdog: 1/1');
    expect(m.severity).toBe('none');
    expect(m.tooltipLines[0]).toMatch(/Watchdog reachability/i);
  });

  it('uses error severity when any server failed', () => {
    const m = buildStatusBarModel([
      healthy(),
      { name: 'bad', state: 'failed', retryCount: 2, lastError: 'down' },
    ]);
    expect(m.severity).toBe('error');
    expect(m.text).toContain('Watchdog: 1/2');
  });

  it('prefers cause sentence over raw Error line (S-STATUS-01)', () => {
    const m = buildStatusBarModel([
      {
        name: 'bad',
        state: 'failed',
        retryCount: 1,
        lastError: 'No token provided. Please provide a valid token.',
      },
    ]);
    const joined = m.tooltipLines.join('\n');
    expect(joined).toMatch(/Missing credential/);
    expect(joined).not.toMatch(/^Error: No token/m);
  });

  it('untrusted uses warning shield', () => {
    const m = buildStatusBarModel([], {
      kind: 'untrusted',
      sources: ['.cursor/mcp.json'],
      serverCount: 2,
    });
    expect(m.text).toContain('untrusted');
    expect(m.severity).toBe('warning');
  });
});
