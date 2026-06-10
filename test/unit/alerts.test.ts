import { describe, expect, it } from 'vitest';
import { decideAlert } from '../../src/alerts';
import type { ServerStatus } from '../../src/monitor';

const base = (state: ServerStatus['state'], extra?: Partial<ServerStatus>): ServerStatus => ({
  name: 'mem',
  state,
  retryCount: 0,
  ...extra,
});

const emptyFlap = { failureTimes: [] as number[], flapping: false, flapAlertSent: false };

describe('decideAlert', () => {
  it('failed transition emits error with four actions', () => {
    const r = decideAlert(
      base('healthy'),
      base('failed', { lastError: 'down' }),
      undefined,
      'failures',
      1000,
      emptyFlap,
    );
    expect(r.alert?.kind).toBe('error');
    expect(r.alert?.actions).toEqual(['Reconnect', 'Show Log', 'Reload Window', 'Mute 1h']);
  });

  it('degraded with recovery in <60s emits no alert immediately', () => {
    const r = decideAlert(
      base('healthy'),
      base('degraded'),
      undefined,
      'failures',
      1000,
      emptyFlap,
    );
    expect(r.alert).toBeUndefined();
    expect(r.degradedSince).toBe(1000);
  });

  it('degraded sustained 60s emits warning', () => {
    const r = decideAlert(
      base('degraded'),
      base('degraded', { lastError: 'timeout' }),
      undefined,
      'failures',
      61_000,
      emptyFlap,
      0,
      60_000,
    );
    expect(r.alert?.kind).toBe('warning');
  });

  it('recovery alert only when notify=all', () => {
    const none = decideAlert(
      base('failed'),
      base('healthy'),
      undefined,
      'failures',
      1000,
      emptyFlap,
    );
    expect(none.alert).toBeUndefined();
    const all = decideAlert(base('failed'), base('healthy'), undefined, 'all', 1000, emptyFlap);
    expect(all.alert?.kind).toBe('info');
  });

  it('mute window suppresses alerts', () => {
    const r = decideAlert(
      base('healthy'),
      base('failed'),
      { muteUntil: 5000 },
      'failures',
      1000,
      emptyFlap,
    );
    expect(r.alert).toBeUndefined();
  });

  it('notify=none never alerts', () => {
    const r = decideAlert(base('healthy'), base('failed'), undefined, 'none', 1000, emptyFlap);
    expect(r.alert).toBeUndefined();
  });

  it('4 failures in 10m emits single flap alert', () => {
    let flap = { ...emptyFlap };
    for (let i = 0; i < 4; i++) {
      const r = decideAlert(
        base('healthy'),
        base('degraded'),
        undefined,
        'failures',
        i * 60_000,
        flap,
      );
      flap = r.flap;
      if (i === 3) {
        expect(r.alert?.kind).toBe('flap');
      } else if (i < 3) {
        expect(r.alert).toBeUndefined();
      }
    }
  });
});
