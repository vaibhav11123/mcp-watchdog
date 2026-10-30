import { describe, expect, it } from 'vitest';
import { evaluatePolicy } from '../../packages/cloud/src/policy/evaluate';

describe('policy/trust plane', () => {
  const rule = {
    id: 't',
    denyUnpinnedNpxY: true,
    allowedCommands: ['node', 'npx'],
  };

  it('denies unpinned npx -y', () => {
    const d = evaluatePolicy(rule, { command: 'npx', args: ['-y', 'foo'] });
    expect(d.allow).toBe(false);
  });

  it('allows node', () => {
    const d = evaluatePolicy(rule, { command: 'node', args: ['server.js'] });
    expect(d.allow).toBe(true);
  });

  it('denies command not on allowlist', () => {
    const d = evaluatePolicy(rule, { command: 'curl' });
    expect(d.allow).toBe(false);
  });
});
