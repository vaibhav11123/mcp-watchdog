import { describe, expect, it } from 'vitest';
import { deleteServerKey, mergeServerCredential } from '../../src/mcpJsonEdit';

const baseJson = JSON.stringify(
  {
    mcpServers: {
      keep: { command: 'node', args: ['a.js'] },
      remove: { command: 'npx', args: ['-y', 'pkg'] },
    },
    otherTop: true,
  },
  null,
  2,
);

describe('deleteServerKey', () => {
  it('removes server and preserves siblings and top-level keys', () => {
    const r = deleteServerKey(`${baseJson}\n`, 'remove');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const parsed = JSON.parse(r.raw) as {
      mcpServers: Record<string, unknown>;
      otherTop: boolean;
    };
    expect(parsed.mcpServers.remove).toBeUndefined();
    expect(parsed.mcpServers.keep).toBeDefined();
    expect(parsed.otherTop).toBe(true);
    expect(r.rootKey).toBe('mcpServers');
  });

  it('refuses JSONC comments and trailing commas', () => {
    const withComment = `{\n  // line\n  "mcpServers": {}\n}`;
    expect(deleteServerKey(withComment, 'x')).toEqual({ ok: false, reason: 'jsonc' });

    const trailing = '{"mcpServers": {"a": {"command": "x"}},}';
    expect(deleteServerKey(trailing, 'a')).toEqual({ ok: false, reason: 'jsonc' });
  });
});

describe('mergeServerCredential', () => {
  it('merges env onto stdio server', () => {
    const raw = JSON.stringify({
      servers: {
        exa: { type: 'stdio', command: 'npx', args: ['exa-mcp-server'] },
      },
    });
    const r = mergeServerCredential(
      raw,
      'exa',
      { kind: 'env', name: 'EXA_API_KEY' },
      'secret-value',
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const parsed = JSON.parse(r.raw) as { servers: { exa: { env: Record<string, string> } } };
    expect(parsed.servers.exa.env.EXA_API_KEY).toBe('secret-value');
  });

  it('merges header onto http server', () => {
    const raw = JSON.stringify({
      mcpServers: {
        remote: { type: 'http', url: 'https://mcp.exa.ai/mcp' },
      },
    });
    const r = mergeServerCredential(
      raw,
      'remote',
      { kind: 'header', name: 'x-api-key' },
      'key-value',
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const parsed = JSON.parse(r.raw) as {
      mcpServers: { remote: { headers: Record<string, string> } };
    };
    expect(parsed.mcpServers.remote.headers['x-api-key']).toBe('key-value');
  });
});
