import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadClaudeCodeServers, resolveHost } from '../../src/cli/loadClaudeCode';
import { parseArgs } from '../../src/cli/main';

describe('cli parseArgs', () => {
  it('parses host cwd and doctor command', () => {
    expect(parseArgs(['--host', 'claude-code', '--cwd', '/tmp', 'doctor'])).toEqual({
      host: 'claude-code',
      cwd: path.resolve('/tmp'),
      help: false,
      command: 'doctor',
      yes: false,
      pretty: false,
      star: false,
      from: undefined,
    });
  });

  it('parses fix --yes and --full', () => {
    expect(parseArgs(['fix', '--yes', '--full', '--cwd', '/tmp'])).toMatchObject({
      command: 'fix',
      yes: true,
      pretty: true,
      cwd: path.resolve('/tmp'),
      star: false,
    });
    expect(parseArgs(['rate', '--star'])).toMatchObject({
      command: 'rate',
      star: true,
    });
  });

  it('parses restore --from', () => {
    expect(
      parseArgs(['restore', '--from', '.mcp-watchdog/backups/x.json', '--cwd', '/tmp']),
    ).toMatchObject({
      command: 'restore',
      from: '.mcp-watchdog/backups/x.json',
      cwd: path.resolve('/tmp'),
    });
  });
});

describe('loadClaudeCodeServers', () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const d of tmpDirs.splice(0)) {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });

  it('merges user then project with project winning', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-cli-home-'));
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-cli-cwd-'));
    tmpDirs.push(home, cwd);

    fs.writeFileSync(
      path.join(home, '.claude.json'),
      JSON.stringify({
        mcpServers: {
          echo: { command: 'node', args: ['user-echo.js'] },
          shared: { command: 'node', args: ['from-user.js'] },
        },
      }),
    );
    fs.writeFileSync(
      path.join(cwd, '.mcp.json'),
      JSON.stringify({
        mcpServers: {
          shared: { command: 'node', args: ['from-project.js'] },
        },
      }),
    );

    const loaded = loadClaudeCodeServers(cwd, home);
    expect(Object.keys(loaded.servers).sort()).toEqual(['echo', 'shared']);
    expect(loaded.servers.shared).toMatchObject({
      type: 'stdio',
      command: 'node',
      args: ['from-project.js'],
    });
    expect(resolveHost('auto', cwd, home)).toBe('claude-code');
  });
});
