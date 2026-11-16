import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { restoreMcpJsonFromBackup } from '../../src/cli/restore';

describe('CLI restore --from', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it('round-trips .mcp.json from backups/', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-rst-'));
    dirs.push(cwd);
    const mcp = path.join(cwd, '.mcp.json');
    const original = JSON.stringify({ mcpServers: { echo: { command: 'node', args: ['a.js'] } } });
    fs.writeFileSync(mcp, original, 'utf8');
    const backupDir = path.join(cwd, '.mcp-watchdog', 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const backup = path.join(backupDir, 'stamp-mcp.json');
    fs.copyFileSync(mcp, backup);
    fs.writeFileSync(mcp, JSON.stringify({ mcpServers: {} }), 'utf8');

    const ok = restoreMcpJsonFromBackup(cwd, backup);
    expect(ok.ok).toBe(true);
    expect(fs.readFileSync(mcp, 'utf8')).toBe(original);
  });

  it('refuses path escape outside backups/', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-rst2-'));
    dirs.push(cwd);
    const outside = path.join(cwd, 'evil.json');
    fs.writeFileSync(outside, '{}', 'utf8');
    const bad = restoreMcpJsonFromBackup(cwd, outside);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toMatch(/backups/);
  });
});
