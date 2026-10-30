import { describe, expect, it } from 'vitest';
import {
  BRIDGE_SCHEMA_VERSION,
  hostOnly,
  scrubBridgePayload,
} from '../../packages/probe-core/src/index';

const valid = {
  schemaVersion: BRIDGE_SCHEMA_VERSION,
  workspaceIdHash: 'abc123',
  extensionVersion: '0.5.2',
  optIn: true as const,
  incident: {
    id: '01TEST',
    serverName: 'echo',
    transport: 'stdio' as const,
    commandName: 'node',
    stateFrom: 'healthy' as const,
    stateTo: 'failed' as const,
    headerNames: ['Authorization'],
    envNames: ['API_KEY'],
    at: '2026-10-30T00:00:00.000Z',
  },
};

describe('scrubBridgePayload', () => {
  it('accepts names-only payload', () => {
    const r = scrubBridgePayload(valid);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.incident.envNames).toEqual(['API_KEY']);
      expect(r.payload.incident.headerNames).toEqual(['Authorization']);
    }
  });

  it('rejects env values object', () => {
    const r = scrubBridgePayload({
      ...valid,
      incident: { ...valid.incident, env: { API_KEY: 'secret' } },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it('rejects headers values object', () => {
    const r = scrubBridgePayload({
      ...valid,
      incident: { ...valid.incident, headers: { Authorization: 'Bearer x' } },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects token key', () => {
    const r = scrubBridgePayload({ ...valid, token: 'leak' });
    expect(r.ok).toBe(false);
  });

  it('rejects when optIn is false', () => {
    const r = scrubBridgePayload({ ...valid, optIn: false });
    expect(r.ok).toBe(false);
  });

  it('strips query from urlHost', () => {
    expect(hostOnly('https://example.com/mcp?token=secret')).toBe('example.com');
    const r = scrubBridgePayload({
      ...valid,
      incident: {
        ...valid.incident,
        transport: 'http',
        urlHost: 'https://example.com/path?apiKey=1',
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.incident.urlHost).toBe('example.com');
  });
});
