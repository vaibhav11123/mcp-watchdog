/**
 * Dump Overview HTML stills (healthy / failed / verified) for visual QA.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  renderOverviewBody,
  statusesSnapshot,
  wrapOverviewDocument,
} from '../src/ui/overviewHtml';

const outDir =
  process.argv[2] ||
  join(process.cwd(), 'docs/validation/release-evidence/v0.5.8-live/stills');
mkdirSync(outDir, { recursive: true });

const cases = [
  {
    id: 'L3-healthy',
    snap: statusesSnapshot(
      [{ name: 'echo', state: 'healthy' as const, retryCount: 0, lastPingMs: 12 }],
      { kind: 'ok', sources: ['.cursor/mcp.json'] },
      {},
    ),
  },
  {
    id: 'L4-failed-cause',
    snap: statusesSnapshot(
      [
        {
          name: 'posthog',
          state: 'failed' as const,
          retryCount: 2,
          lastError: 'No token provided. Please provide a valid token.',
        },
      ],
      { kind: 'ok', sources: ['.cursor/mcp.json'] },
      {},
    ),
  },
  {
    id: 'L7-verified-unresolved',
    snap: statusesSnapshot(
      [
        {
          name: 'echo',
          state: 'failed' as const,
          retryCount: 1,
          lastError: 'Max retries exceeded',
          verifiedOutcome: 'unresolved',
        },
      ],
      { kind: 'ok', sources: ['.cursor/mcp.json'] },
      {},
    ),
  },
];

for (const c of cases) {
  const body = renderOverviewBody(c.snap);
  const doc = wrapOverviewDocument(body, 'live-qa');
  const path = join(outDir, `${c.id}.html`);
  writeFileSync(path, doc);
  console.log('wrote', path);
}
