/** Streamable HTTP check ids aligned with mcp-http-probe (re-derived; MIT-aware). */

export type ProbePack = 'liveness' | 'session' | 'conformance';

export type CheckLevel = 'MUST' | 'SHOULD' | 'INFO';

export interface CheckDef {
  id: string;
  pack: ProbePack;
  level: CheckLevel;
  /** Expected HTTP status(es) when applicable. */
  expectedStatus?: number[];
  title: string;
}

export const CHECK_DEFS: readonly CheckDef[] = [
  {
    id: 'initialize',
    pack: 'liveness',
    level: 'MUST',
    expectedStatus: [200],
    title: 'initialize succeeds over POST',
  },
  {
    id: 'content-type',
    pack: 'liveness',
    level: 'MUST',
    title: 'Response is application/json or text/event-stream',
  },
  {
    id: 'tools-list',
    pack: 'liveness',
    level: 'MUST',
    expectedStatus: [200],
    title: 'tools/list returns a tools array',
  },
  {
    id: 'tool-input-schema',
    pack: 'liveness',
    level: 'MUST',
    title: 'Every tool has an inputSchema of type object',
  },
  {
    id: 'tool-unique',
    pack: 'liveness',
    level: 'MUST',
    title: 'Tool names are unique',
  },
  {
    id: 'session-unknown',
    pack: 'session',
    level: 'MUST',
    expectedStatus: [404],
    title: 'Unknown Mcp-Session-Id returns 404',
  },
  {
    id: 'session-terminated',
    pack: 'session',
    level: 'MUST',
    expectedStatus: [404],
    title: 'Requests on a terminated session return 404',
  },
  {
    id: 'session-required',
    pack: 'session',
    level: 'SHOULD',
    expectedStatus: [400],
    title: 'Request without Mcp-Session-Id returns 400',
  },
  {
    id: 'origin-validation',
    pack: 'conformance',
    level: 'MUST',
    expectedStatus: [403],
    title: 'Rejects a foreign Origin with 403',
  },
  {
    id: 'accept-header',
    pack: 'conformance',
    level: 'SHOULD',
    expectedStatus: [406, 400],
    title: 'Rejects POST whose Accept omits text/event-stream',
  },
  {
    id: 'notification-202',
    pack: 'conformance',
    level: 'MUST',
    expectedStatus: [202],
    title: 'Accepted notification returns 202 with no body',
  },
  {
    id: 'protocol-version-header',
    pack: 'conformance',
    level: 'MUST',
    expectedStatus: [400],
    title: 'Unsupported MCP-Protocol-Version header returns 400',
  },
  {
    id: 'get-stream',
    pack: 'conformance',
    level: 'MUST',
    expectedStatus: [200, 405],
    title: 'GET returns an SSE stream or 405',
  },
] as const;

export function checksForPack(pack: ProbePack): CheckDef[] {
  return CHECK_DEFS.filter((c) => c.pack === pack);
}
