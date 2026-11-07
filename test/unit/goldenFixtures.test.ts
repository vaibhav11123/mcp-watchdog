/**
 * Phase 4 — golden diagnostic fixtures: same failure text → same causeId
 * across vendor-looking server names (CAUSE-CATALOG / ARCH §5b).
 */
import { describe, expect, it } from 'vitest';
import { diagnose } from '../../packages/probe-core/src/diagnostics/diagnose';
import { causeSentence } from '../../packages/probe-core/src/diagnostics/causeSentence';

describe('Phase 4 golden fixtures (cross-host causeId)', () => {
  it.each(['posthog', 'acme', 'my-http-mcp'])(
    '%s + No token provided → auth.missing',
    (serverName) => {
      const d = diagnose({
        serverName,
        lastError: 'No token provided. Please provide a valid token.',
      });
      expect(d.causeId).toBe('auth.missing');
      expect(causeSentence(d.causeId)).toMatch(/credential|token|auth/i);
    },
  );

  it.each(['echo', 'filesystem', 'memory'])(
    '%s + bare Max retries exceeded → spawn.closed',
    (serverName) => {
      const d = diagnose({
        serverName,
        lastError: 'Max retries exceeded',
      });
      expect(d.causeId).toBe('spawn.closed');
      expect(causeSentence(d.causeId)).toMatch(/Process closed|connection/i);
    },
  );

  it('401 unauthorized → auth.rejected regardless of server name', () => {
    for (const serverName of ['exa', 'custom-api', 'vendor-x']) {
      const d = diagnose({
        serverName,
        lastError: 'HTTP 401 Unauthorized',
      });
      expect(d.causeId).toBe('auth.rejected');
    }
  });
});
