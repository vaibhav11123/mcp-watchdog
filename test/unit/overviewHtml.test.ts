import { describe, expect, it } from 'vitest';
import { renderOverviewBody, statusesSnapshot } from '../../src/ui/overviewHtml';
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
});
