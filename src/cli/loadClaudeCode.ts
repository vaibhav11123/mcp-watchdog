import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  mergeConfigLayers,
  parseConfigFile,
  type ConfigLayer,
  type McpServerConfig,
} from '../config-core';

export function claudeCodeUserPath(home = os.homedir()): string {
  return path.join(home, '.claude.json');
}

export function claudeCodeProjectPath(cwd: string): string {
  return path.join(cwd, '.mcp.json');
}

function readLayer(filePath: string, label: string, workspaceRoot: string): ConfigLayer | null {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
  const parsed = parseConfigFile(raw, workspaceRoot);
  if (!parsed.ok) return null;
  return { servers: parsed.servers, label, path: filePath };
}

/**
 * Claude Code harness configs: user `~/.claude.json` then project `.mcp.json` (project wins).
 */
export function loadClaudeCodeServers(
  cwd: string,
  home = os.homedir(),
): {
  servers: Record<string, McpServerConfig>;
  origins: Record<string, { path: string; label: string }>;
  sources: string[];
} {
  const user = readLayer(claudeCodeUserPath(home), 'Claude Code user', cwd);
  const project = readLayer(claudeCodeProjectPath(cwd), 'Claude Code project', cwd);
  const layers = [user, project].filter(Boolean) as ConfigLayer[];
  const { merged, origins } = mergeConfigLayers(layers);
  return {
    servers: merged,
    origins,
    sources: layers.map((l) => l.path),
  };
}

export function resolveHost(
  host: string,
  cwd: string,
  home = os.homedir(),
): 'claude-code' | 'unsupported' {
  if (host === 'claude-code') return 'claude-code';
  if (host === 'auto') {
    const hasUser = fs.existsSync(claudeCodeUserPath(home));
    const hasProject = fs.existsSync(claudeCodeProjectPath(cwd));
    if (hasUser || hasProject) return 'claude-code';
  }
  return 'unsupported';
}
