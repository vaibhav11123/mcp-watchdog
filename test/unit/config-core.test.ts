import { describe, expect, it } from 'vitest';
import {
  emptyViewMessage,
  expandWorkspaceVars,
  mergeConfigLayers,
  parseConfigFile,
} from '../../src/config-core';

describe('parseConfigFile', () => {
  it('parses VS Code servers shape', () => {
    const raw = JSON.stringify({
      servers: {
        memory: { type: 'stdio', command: 'npx', args: ['-y', 'mem'] },
      },
    });
    const r = parseConfigFile(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.servers.memory).toEqual({
        type: 'stdio',
        command: 'npx',
        args: ['-y', 'mem'],
      });
    }
  });

  it('parses Cursor mcpServers shape', () => {
    const raw = JSON.stringify({
      mcpServers: {
        exa: { command: 'npx', args: ['-y', 'exa'] },
      },
    });
    const r = parseConfigFile(raw);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.servers.exa.command).toBe('npx');
  });

  it('normalizes http with url', () => {
    const raw = JSON.stringify({
      servers: {
        remote: { type: 'http', url: 'http://localhost:3000', headers: { Authorization: 'x' } },
      },
    });
    const r = parseConfigFile(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.servers.remote).toMatchObject({ type: 'http', url: 'http://localhost:3000' });
    }
  });

  it('drops entries missing command and url', () => {
    const raw = JSON.stringify({ servers: { bad: { type: 'stdio' }, good: { command: 'node' } } });
    const r = parseConfigFile(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.servers.bad).toBeUndefined();
      expect(r.servers.good.command).toBe('node');
    }
  });

  it('drops explicit type http without url', () => {
    const raw = JSON.stringify({ servers: { bad: { type: 'http' } } });
    const r = parseConfigFile(raw);
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys(r.servers)).toHaveLength(0);
  });

  it('expands ${workspaceFolder} in nested values', () => {
    const root = '/proj';
    const raw = JSON.stringify({
      servers: {
        fs: {
          command: 'node',
          args: ['${workspaceFolder}/srv.js'],
          cwd: '${workspaceFolder}',
        },
      },
    });
    const r = parseConfigFile(raw, root);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.servers.fs.args).toEqual(['/proj/srv.js']);
      expect(r.servers.fs.cwd).toBe('/proj');
    }
  });

  it('returns syntax error for invalid JSON', () => {
    expect(parseConfigFile('{ bad')).toEqual({ ok: false, error: 'syntax' });
  });

  it('returns no_block when servers key missing', () => {
    expect(parseConfigFile('{}')).toEqual({ ok: false, error: 'no_block' });
  });
});

describe('mergeConfigLayers', () => {
  it('later layer overrides same server name', () => {
    const { merged, sources } = mergeConfigLayers([
      { label: 'global', servers: { a: { type: 'stdio', command: 'g' } } },
      { label: 'project', servers: { a: { type: 'stdio', command: 'p' } } },
    ]);
    expect(merged.a.command).toBe('p');
    expect(sources).toEqual(['global', 'project']);
  });

  it('merges distinct server names', () => {
    const { merged } = mergeConfigLayers([
      { label: 'a', servers: { x: { type: 'stdio', command: '1' } } },
      { label: 'b', servers: { y: { type: 'stdio', command: '2' } } },
    ]);
    expect(Object.keys(merged).sort()).toEqual(['x', 'y']);
  });

  it('deduplicates sources list', () => {
    const layer = { label: 'same', servers: { s: { type: 'stdio', command: 'c' } } };
    const { sources } = mergeConfigLayers([layer, layer]);
    expect(sources).toEqual(['same']);
  });
});

describe('expandWorkspaceVars', () => {
  it('leaves values unchanged without root', () => {
    expect(expandWorkspaceVars('${workspaceFolder}/x', undefined)).toBe('${workspaceFolder}/x');
  });
});

describe('emptyViewMessage', () => {
  it('returns guidance for no_workspace', () => {
    expect(emptyViewMessage({ kind: 'no_workspace' })).toContain('Open a folder');
  });

  it('returns guidance for untrusted', () => {
    expect(
      emptyViewMessage({ kind: 'untrusted', sources: ['.cursor/mcp.json'], serverCount: 2 }),
    ).toContain('Approval required');
  });
});
