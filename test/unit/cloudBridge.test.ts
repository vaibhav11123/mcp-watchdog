import { describe, expect, it, vi } from 'vitest';
import { buildBridgePayload, postBridgeIncident, workspaceIdHash } from '../../src/cloudBridge';
import { BRIDGE_SCHEMA_VERSION } from '../../packages/probe-core/src/bridge/schema';

describe('workspaceIdHash', () => {
  it('is stable hex slice', () => {
    const a = workspaceIdHash('/proj/a');
    expect(a).toMatch(/^[a-f0-9]{32}$/);
    expect(a).toBe(workspaceIdHash('/proj/a'));
  });
});

describe('buildBridgePayload', () => {
  it('includes env/header names only, not values', () => {
    const payload = buildBridgePayload({
      workspaceIdHash: 'abc',
      extensionVersion: '0.5.3',
      serverName: 'exa',
      config: {
        type: 'http',
        url: 'https://mcp.exa.ai/mcp',
        headers: { 'x-api-key': 'must-not-leak' },
      },
      stateFrom: 'healthy',
      stateTo: 'failed',
      errorClass: 'auth',
    });
    expect(payload.schemaVersion).toBe(BRIDGE_SCHEMA_VERSION);
    expect(payload.incident.headerNames).toEqual(['x-api-key']);
    expect(payload.incident.envNames).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain('must-not-leak');
  });
});

describe('postBridgeIncident', () => {
  it('posts scrubbed payload via fetch mock', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 201 }) as Response);
    const payload = buildBridgePayload({
      workspaceIdHash: 'w',
      extensionVersion: '0.5.3',
      serverName: 'echo',
      config: { type: 'stdio', command: 'echo', args: ['hi'] },
      stateFrom: 'healthy',
      stateTo: 'degraded',
    });
    const r = await postBridgeIncident('https://bridge.example.com/', payload, fetchImpl);
    expect(r.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://bridge.example.com/v1/bridge/incidents',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body.incident.serverName).toBe('echo');
  });

  it('rejects secrets before fetch', async () => {
    const fetchImpl = vi.fn();
    const payload = buildBridgePayload({
      workspaceIdHash: 'w',
      extensionVersion: '0.5.3',
      serverName: 'bad',
      config: { type: 'stdio', command: 'node' },
      stateFrom: 'healthy',
      stateTo: 'failed',
    });
    (payload as { token?: string }).token = 'leak';
    const r = await postBridgeIncident('https://bridge.example.com', payload, fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
