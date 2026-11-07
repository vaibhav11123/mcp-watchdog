import { describe, expect, it } from 'vitest';
import { softStopFromToolDrift } from '../../packages/probe-core/src/diagnostics/softStop';

describe('softStopFromToolDrift (Phase 5 scaffold)', () => {
  it('warns on tool drift without implying probe failure', () => {
    const s = softStopFromToolDrift(true);
    expect(s.contractStatus).toBe('warn');
    expect(s.message).toMatch(/advisory/i);
  });

  it('ok when no drift', () => {
    expect(softStopFromToolDrift(false)).toEqual({ contractStatus: 'ok' });
  });

  it('unknown when unobserved', () => {
    expect(softStopFromToolDrift(undefined).contractStatus).toBe('unknown');
  });
});
