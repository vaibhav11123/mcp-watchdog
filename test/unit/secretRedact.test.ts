import { describe, expect, it } from 'vitest';
import { redactLogTail, redactSecrets } from '../../src/secretRedact';

describe('redactSecrets', () => {
  it('redacts Bearer tokens', () => {
    expect(redactSecrets('Auth: Bearer sk-live-abc123xyz')).toBe('Auth: [redacted]');
  });

  it('redacts api_key= values', () => {
    expect(redactSecrets('config api_key=supersecret')).toBe('config [redacted]');
  });
});

describe('redactLogTail', () => {
  it('caps line count and character length', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i} api_key=leak${i}`);
    const tail = redactLogTail(lines, 5, 50);
    const outLines = tail.split('\n');
    expect(outLines.length).toBeLessThanOrEqual(5);
    expect(tail.length).toBeLessThanOrEqual(50);
    expect(tail).not.toMatch(/api_key=\S+/);
  });
});
