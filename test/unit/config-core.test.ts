import * as path from 'path';
import { describe, expect, it } from 'vitest';
import {
  emptyViewMessage,
  expandWorkspaceVars,
  mergeConfigLayers,
  parseConfigFile,
  projectMcpJsonPaths,
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

  it('normalizes type sse and url+transport sse', () => {
    const typed = parseConfigFile(
      JSON.stringify({
        servers: { a: { type: 'sse', url: 'http://localhost:4000/sse' } },
      }),
    );
    expect(typed.ok).toBe(true);
    if (typed.ok)
      expect(typed.servers.a).toMatchObject({ type: 'sse', url: 'http://localhost:4000/sse' });

    const viaTransport = parseConfigFile(
      JSON.stringify({
        servers: { b: { url: 'http://localhost:4001/sse', transport: 'sse' } },
      }),
    );
    expect(viaTransport.ok).toBe(true);
    if (viaTransport.ok) {
      expect(viaTransport.servers.b).toMatchObject({
        type: 'sse',
        url: 'http://localhost:4001/sse',
      });
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

  it('expands ${userHome} and ${env:NAME}', () => {
    const expanded = expandWorkspaceVars('${userHome}/bin:${env:TEST_WD_VAR}', {
      userHome: '/Users/me',
      env: { TEST_WD_VAR: 'hello' },
    });
    expect(expanded).toBe('/Users/me/bin:hello');
  });

  it('leaves missing ${env:NAME} literal', () => {
    expect(
      expandWorkspaceVars('${env:THIS_VAR_SHOULD_NOT_EXIST_WD}', {
        env: {},
      }),
    ).toBe('${env:THIS_VAR_SHOULD_NOT_EXIST_WD}');
  });

  it('does not expand ${input:…}', () => {
    expect(
      expandWorkspaceVars('${input:apiKey}', {
        workspaceRoot: '/p',
        userHome: '/h',
        env: {},
      }),
    ).toBe('${input:apiKey}');
  });
});

describe('parseConfigFile env expansion', () => {
  it('expands env in args via expandCtx', () => {
    const raw = JSON.stringify({
      servers: {
        fs: {
          command: 'node',
          args: ['${env:HOME}/srv.js'],
          cwd: '${userHome}/work',
        },
      },
    });
    const r = parseConfigFile(raw, '/proj', {
      userHome: '/Users/me',
      env: { HOME: '/Users/me' },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.servers.fs.args).toEqual(['/Users/me/srv.js']);
      expect(r.servers.fs.cwd).toBe('/Users/me/work');
    }
  });
});

describe('projectMcpJsonPaths', () => {
  it('returns vscode and cursor paths for every folder root', () => {
    const paths = projectMcpJsonPaths([path.join('a'), path.join('b')]);
    expect(paths).toEqual([
      path.join('a', '.vscode', 'mcp.json'),
      path.join('a', '.cursor', 'mcp.json'),
      path.join('b', '.vscode', 'mcp.json'),
      path.join('b', '.cursor', 'mcp.json'),
    ]);
  });

  it('returns empty for no folders', () => {
    expect(projectMcpJsonPaths([])).toEqual([]);
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
