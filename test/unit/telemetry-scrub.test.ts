import { describe, expect, it } from 'vitest';
import {
  isAllowedEvent,
  materializeCaptureProperties,
  scrubProperties,
} from '../../src/telemetry/scrub';

describe('scrubProperties', () => {
  it('keeps allowlisted primitives', () => {
    const out = scrubProperties({
      extVersion: '0.5.5',
      editor: 'Cursor',
      serverCount: 3,
      action: 'accept',
    });
    expect(out).toEqual({
      extVersion: '0.5.5',
      editor: 'Cursor',
      serverCount: 3,
      action: 'accept',
    });
  });

  it('drops unknown and banned keys', () => {
    const out = scrubProperties({
      action: 'accept',
      secretToken: 'x',
      password: 'y',
      lastError: 'boom',
      workspacePath: '/tmp',
      command: 'npx',
      args: ['a'],
      mystery: 'nope',
    });
    expect(out).toEqual({ action: 'accept' });
    expect(JSON.stringify(out)).not.toContain('boom');
    expect(JSON.stringify(out)).not.toContain('npx');
  });

  it('scrubs $set nested objects and JSON strings', () => {
    const fromObj = scrubProperties({
      extVersion: '0.5.5',
      $set: { extVersion: '0.5.5', editor: 'Cursor', api_key: 'leak' },
    });
    expect(fromObj.$set).toEqual({ extVersion: '0.5.5', editor: 'Cursor' });

    const fromJson = scrubProperties({
      $set: JSON.stringify({ editor: 'VS Code', token: 'no' }),
    });
    expect(fromJson.$set).toEqual({ editor: 'VS Code' });
  });

  it('truncates long strings', () => {
    const long = 'x'.repeat(250);
    const out = scrubProperties({ editor: long });
    expect(typeof out.editor).toBe('string');
    expect(String(out.editor).length).toBe(200);
  });
});

describe('isAllowedEvent / materialize', () => {
  it('allows dictionary events only', () => {
    expect(isAllowedEvent('activation')).toBe(true);
    expect(isAllowedEvent('evil')).toBe(false);
  });

  it('always adds $lib', () => {
    expect(materializeCaptureProperties({ action: 'mute' })).toEqual({
      $lib: 'mcp-watchdog',
      action: 'mute',
    });
  });
});
