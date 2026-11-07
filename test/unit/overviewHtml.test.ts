import { describe, expect, it } from 'vitest';
import {
  renderOverviewBody,
  statusesSnapshot,
  wrapOverviewDocument,
} from '../../src/ui/overviewHtml';
import type { ServerStatus } from '../../src/monitor';

const offline = (name: string): ServerStatus => ({
  name,
  state: 'disconnected',
  retryCount: 0,
  lastError: 'Awaiting approval',
});

describe('overviewHtml', () => {
  it('untrusted with folder+servers never shows Open a folder', () => {
    const snap = statusesSnapshot(
      [offline('exa'), offline('rea')],
      { kind: 'untrusted', sources: ['.cursor/mcp.json'], serverCount: 2 },
      {},
    );
    const body = renderOverviewBody(snap);
    expect(body).not.toMatch(/Open a folder/i);
    expect(body).toMatch(/Review &amp; allow/);
    expect(body).toMatch(/need your approval/i);
    expect(body).toMatch(/exa/);
  });

  it('untrusted empty statuses still shows approval CTA', () => {
    const body = renderOverviewBody(
      statusesSnapshot([], { kind: 'untrusted', sources: [], serverCount: 3 }, {}),
    );
    expect(body).not.toMatch(/Open a folder/i);
    expect(body).toMatch(/Review &amp; allow/);
    expect(body).toMatch(/3 MCP server/);
  });

  it('no_workspace empty shows Open a folder', () => {
    const body = renderOverviewBody(statusesSnapshot([], { kind: 'no_workspace' }, {}));
    expect(body).toMatch(/Open a folder/);
  });

  it('ok empty does not claim Open a folder', () => {
    const body = renderOverviewBody(
      statusesSnapshot([], { kind: 'ok', sources: ['.cursor/mcp.json'] }, {}),
    );
    expect(body).not.toMatch(/Open a folder/i);
  });

  it('failed row shows cause sentence and first action (S-OVERVIEW-FAILED-01)', () => {
    const snap = statusesSnapshot(
      [
        {
          name: 'posthog',
          state: 'failed',
          retryCount: 1,
          lastError: 'No token provided. Please provide a valid token.',
        },
      ],
      { kind: 'ok', sources: ['.cursor/mcp.json'] },
      {},
    );
    const body = renderOverviewBody(snap);
    expect(body).toMatch(/Missing credential/);
    expect(body).toMatch(/Show Log/);
    expect(body).toMatch(/Editor session: Unknown/);
    expect(body).not.toMatch(/No token provided/);
  });

  it('dashboard uses Reconnecting metric and has no footer essays', () => {
    const body = renderOverviewBody(
      statusesSnapshot(
        [{ name: 'echo', state: 'healthy', retryCount: 0, lastPingMs: 10 }],
        { kind: 'ok', sources: ['.cursor/mcp.json'] },
        {},
      ),
    );
    expect(body).toMatch(/Reconnecting/);
    expect(body).not.toMatch(/>Active</);
    expect(body).not.toMatch(/What this shows/);
    expect(body).not.toMatch(/Next step:/);
  });

  it('document chrome clamps horizontal overflow (L9)', () => {
    const doc = wrapOverviewDocument(
      '<h1>MCP Watchdog</h1><button data-action="reconnectAll">Retry all probes</button>',
      'nonce',
    );
    expect(doc).toMatch(/overflow-x:\s*hidden/);
    expect(doc).toMatch(/data-action="reconnectAll"/);
  });
});
