import { describe, expect, it } from 'vitest';
import {
  buildFixSteps,
  classifyFailure,
  filterFixStepsForHostCaps,
  normalizeAcceptedList,
  resolveFailureText,
  shouldSuppressAlert,
  statusesForChip,
  type FixStep,
} from '../../src/failureTriage';
import { buildStatusBarModel } from '../../src/ui/statusBarModel';
import type { ServerStatus } from '../../src/monitor';

function status(name: string, state: ServerStatus['state']): ServerStatus {
  return { name, state, retryCount: 0 };
}

describe('classifyFailure', () => {
  it('aws-mcp + -32602 Invalid request parameters → aws_session', () => {
    expect(
      classifyFailure({
        serverName: 'user-aws-mcp',
        lastProbeError: 'Error -32602: Invalid request parameters',
      }),
    ).toBe('aws_session');
  });

  it.each(['echo', 'exa', 'rea'])('%s + -32602 → generic', (serverName) => {
    expect(
      classifyFailure({
        serverName,
        lastError: '-32602 Invalid request parameters',
      }),
    ).toBe('generic');
  });

  it('session expired / aws login text → aws_session', () => {
    expect(classifyFailure({ serverName: 'x', lastError: 'Your session has expired' })).toBe(
      'aws_session',
    );
    expect(classifyFailure({ serverName: 'x', lastError: 'Run aws login to reauthenticate' })).toBe(
      'aws_session',
    );
  });

  it('Auth required (HTTP 401) → auth', () => {
    expect(classifyFailure({ serverName: 'remote', lastError: 'Auth required (HTTP 401)' })).toBe(
      'auth',
    );
  });

  it('spawn ENOENT → spawn', () => {
    expect(classifyFailure({ serverName: 'bad', lastError: 'spawn npx ENOENT' })).toBe('spawn');
  });

  it('-32000 Connection closed → spawn', () => {
    expect(classifyFailure({ serverName: 'x', lastError: '-32000: Connection closed' })).toBe(
      'spawn',
    );
  });

  it('Max retries + lastProbeError aws → aws_session via lastProbeError', () => {
    const text = resolveFailureText({
      serverName: 'svc',
      lastError: 'Max retries exceeded',
      lastProbeError: 'aws login required — credential expired',
      failureContext: 'Max retries exceeded\n[svc] Probe failed: ignored',
    });
    expect(text).toContain('aws login');
    expect(
      classifyFailure({
        serverName: 'svc',
        lastError: 'Max retries exceeded',
        lastProbeError: 'aws login required — credential expired',
      }),
    ).toBe('aws_session');
  });
});

describe('statusesForChip + buildStatusBarModel accept math', () => {
  it('5/6 → 5/5 when one failed is accepted', () => {
    const raw: ServerStatus[] = [
      ...Array.from({ length: 5 }, (_, i) => status(`h${i}`, 'healthy')),
      status('broken', 'failed'),
    ];
    const before = buildStatusBarModel(raw);
    expect(before.text).toContain('5/6');

    const chip = statusesForChip(raw, new Set(['broken']));
    const after = buildStatusBarModel(chip);
    expect(after.text).toContain('5/5');
  });

  it('2/3 → 2/2 when failed accepted', () => {
    const raw: ServerStatus[] = [
      status('a', 'healthy'),
      status('b', 'healthy'),
      status('c', 'failed'),
    ];
    expect(buildStatusBarModel(raw).text).toContain('2/3');
    const chip = statusesForChip(raw, ['c']);
    expect(buildStatusBarModel(chip).text).toContain('2/2');
  });

  it('0/1 after accept removes lone failed from chip', () => {
    const raw: ServerStatus[] = [status('only', 'failed')];
    expect(buildStatusBarModel(raw).text).toContain('0/1');
    const chip = statusesForChip(raw, new Set(['only']));
    expect(chip).toHaveLength(0);
    expect(buildStatusBarModel(chip).tooltipLines[0]).toMatch(/No MCP servers/i);
  });
});

describe('shouldSuppressAlert', () => {
  it('returns true when server name is accepted', () => {
    expect(shouldSuppressAlert('echo', ['echo', 'other'])).toBe(true);
    expect(shouldSuppressAlert('missing', ['echo'])).toBe(false);
  });
});

describe('normalizeAcceptedList', () => {
  it('dedupes strings and drops non-strings', () => {
    expect(normalizeAcceptedList(['a', 'a', '', 1, 'b'])).toEqual(['a', 'b']);
    expect(normalizeAcceptedList(null)).toEqual([]);
  });
});

describe('buildFixSteps wave2', () => {
  it('aws_session includes terminal.awsLogin when wave2', () => {
    const steps = buildFixSteps('aws_session', {
      serverName: 'aws',
      awsProfileId: 'dev',
      wave2Actions: true,
    });
    expect(steps.some((s) => s.id === 'terminal.awsLogin')).toBe(true);
  });

  it('auth with loginUrl includes openExternal.login and credential.wizard', () => {
    const steps = buildFixSteps('auth', {
      serverName: 'exa',
      wave2Actions: true,
      loginUrl: 'https://mcp.exa.ai/mcp?login',
    });
    expect(steps.some((s) => s.id === 'openExternal.login')).toBe(true);
    expect(steps.some((s) => s.id === 'credential.wizard')).toBe(true);
  });
});

describe('filterFixStepsForHostCaps', () => {
  const steps: FixStep[] = [
    { id: 'retry.probe', label: 'Retry probe' },
    { id: 'restart.editorMcp', label: 'Restart editor MCP' },
    { id: 'reload.window', label: 'Reload Window' },
  ];

  it('keeps restart when canRestartServer is true or undefined', () => {
    expect(filterFixStepsForHostCaps(steps, true).some((s) => s.id === 'restart.editorMcp')).toBe(
      true,
    );
    expect(
      filterFixStepsForHostCaps(steps, undefined).some((s) => s.id === 'restart.editorMcp'),
    ).toBe(true);
  });

  it('omits restart.editorMcp when canRestartServer is false', () => {
    const filtered = filterFixStepsForHostCaps(steps, false);
    expect(filtered.some((s) => s.id === 'restart.editorMcp')).toBe(false);
    expect(filtered.map((s) => s.id)).toEqual(['retry.probe', 'reload.window']);
  });
});
