import { describe, expect, it } from 'vitest';
import { lintMcpJsonRaw } from '../../src/config-lint';

describe('lintMcpJsonRaw', () => {
  it('errors on invalid JSON', () => {
    const diags = lintMcpJsonRaw('{ bad');
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({
      severity: 'error',
      message: 'Invalid JSON',
    });
  });

  it('warns when both servers and mcpServers are missing', () => {
    const diags = lintMcpJsonRaw(JSON.stringify({ other: {} }));
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({
      severity: 'warning',
      message: 'Missing "servers" or "mcpServers" root key',
    });
  });

  it('warns on empty servers object', () => {
    const diags = lintMcpJsonRaw(JSON.stringify({ servers: {} }));
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({
      severity: 'warning',
      message: 'Empty servers object',
    });
  });

  it('warns on empty mcpServers object', () => {
    const diags = lintMcpJsonRaw(JSON.stringify({ mcpServers: {} }));
    expect(diags).toEqual([
      expect.objectContaining({
        severity: 'warning',
        message: 'Empty servers object',
      }),
    ]);
  });

  it('errors when an entry is missing both command and url', () => {
    const diags = lintMcpJsonRaw(
      JSON.stringify({
        servers: {
          bad: { type: 'stdio' },
          good: { command: 'node' },
        },
      }),
    );
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({
      severity: 'error',
      message: 'Server "bad" is missing both "command" and "url"',
    });
  });

  it('errors for http-type entry without url', () => {
    const diags = lintMcpJsonRaw(
      JSON.stringify({
        servers: { remote: { type: 'http' } },
      }),
    );
    expect(diags).toEqual([
      expect.objectContaining({
        severity: 'error',
        message: 'Server "remote" is missing both "command" and "url"',
      }),
    ]);
  });

  it('returns no diagnostics for valid stdio and http entries', () => {
    expect(
      lintMcpJsonRaw(
        JSON.stringify({
          servers: {
            local: { command: 'npx', args: ['-y', 'mem'] },
            remote: { url: 'http://localhost:3000' },
          },
        }),
      ),
    ).toEqual([]);
  });

  it('accepts Cursor mcpServers shape without expanding vars', () => {
    expect(
      lintMcpJsonRaw(
        JSON.stringify({
          mcpServers: {
            fs: {
              command: 'node',
              args: ['${workspaceFolder}/srv.js'],
            },
          },
        }),
      ),
    ).toEqual([]);
  });
});
