/**
 * Light HTTP reachability probe (no MCP session).
 * Never logs header values — callers must not either.
 */

export interface PassiveHttpResult {
  reachable: boolean;
  status?: number;
  error?: string;
}

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<{ status: number }>;

/**
 * Probe an HTTP endpoint with HEAD (GET fallback on 405/501).
 * Treats any response with status < 500 as reachable (including 401/404).
 */
export async function probeHttpEndpoint(
  url: string,
  fetchImpl: FetchLike = globalThis.fetch as FetchLike,
  headers?: Record<string, string>,
): Promise<PassiveHttpResult> {
  const init: RequestInit = {
    method: 'HEAD',
    redirect: 'follow',
  };
  if (headers && Object.keys(headers).length > 0) {
    init.headers = headers;
  }

  try {
    let res = await fetchImpl(url, init);
    if (res.status === 405 || res.status === 501) {
      res = await fetchImpl(url, { ...init, method: 'GET' });
    }
    return { reachable: res.status < 500, status: res.status };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { reachable: false, error };
  }
}
