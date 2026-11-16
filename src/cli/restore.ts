import * as fs from 'fs';
import * as path from 'path';

export type RestoreResult = { ok: true; from: string; to: string } | { ok: false; reason: string };

/**
 * Restore `.mcp.json` from a backup under `<cwd>/.mcp-watchdog/backups/`.
 * Refuses path escape outside that backups directory.
 */
export function restoreMcpJsonFromBackup(cwd: string, fromArg: string): RestoreResult {
  const backupsRoot = path.resolve(cwd, '.mcp-watchdog', 'backups');
  const resolved = path.resolve(cwd, fromArg);
  const rel = path.relative(backupsRoot, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return { ok: false, reason: 'backup path must be under .mcp-watchdog/backups/' };
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return { ok: false, reason: 'backup file not found' };
  }
  const to = path.join(cwd, '.mcp.json');
  const dir = path.dirname(to);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${to}.${process.pid}.tmp`;
  fs.copyFileSync(resolved, tmp);
  fs.renameSync(tmp, to);
  return { ok: true, from: resolved, to };
}
