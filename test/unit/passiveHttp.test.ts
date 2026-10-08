import { describe, expect, it, vi } from 'vitest';
import { probeHttpEndpoint, type FetchLike } from '../../src/passiveHttp';

describe('probeHttpEndpoint', () => {
  it('treats HEAD 200 as reachable', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => ({ status: 200 }));
    const r = await probeHttpEndpoint('http://localhost/mcp', fetchImpl);
    expect(r).toEqual({ reachable: true, status: 200 });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost/mcp',
      expect.objectContaining({ method: 'HEAD' }),
    );
  });

  it('falls back to GET on 405', async () => {
    const fetchImpl: FetchLike = vi
      .fn()
      .mockResolvedValueOnce({ status: 405 })
      .mockResolvedValueOnce({ status: 200 });
    const r = await probeHttpEndpoint('http://localhost/mcp', fetchImpl);
    expect(r.reachable).toBe(true);
    expect(r.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenLastCalledWith(
      'http://localhost/mcp',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('treats 401 as reachable (auth required, host up)', async () => {
    const fetchImpl: FetchLike = async () => ({ status: 401 });
    const r = await probeHttpEndpoint('http://localhost/mcp', fetchImpl);
    expect(r).toEqual({ reachable: true, status: 401 });
  });

  it('treats 503 as unreachable', async () => {
    const fetchImpl: FetchLike = async () => ({ status: 503 });
    const r = await probeHttpEndpoint('http://localhost/mcp', fetchImpl);
    expect(r).toEqual({ reachable: false, status: 503 });
  });

  it('returns error message on network failure', async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error('ECONNREFUSED');
    };
    const r = await probeHttpEndpoint('http://localhost/mcp', fetchImpl);
    expect(r.reachable).toBe(false);
    expect(r.error).toBe('ECONNREFUSED');
  });

  it('passes header names without logging values', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => ({ status: 204 }));
    await probeHttpEndpoint('http://localhost/mcp', fetchImpl, { Authorization: 'secret' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost/mcp',
      expect.objectContaining({
        headers: { Authorization: 'secret' },
      }),
    );
  });
});
