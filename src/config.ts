import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export type McpServerConfig =
  | {
      type: 'stdio';
      command: string;
      args?: string[];
      env?: Record<string, string>;
      cwd?: string;
    }
  | {
      type: 'http';
      url: string;
      headers?: Record<string, string>;
    };

export interface McpConfig {
  servers: Record<string, McpServerConfig>;
}

const WORKSPACE_FOLDER = /\$\{workspaceFolder\}/g;

/** Same placeholder VS Code substitutes for MCP; watchdog reads JSON from disk, so expand explicitly. */
function expandWorkspaceVars<V>(value: V, workspaceRoot: string): V {
  if (typeof value === 'string') return value.replace(WORKSPACE_FOLDER, workspaceRoot) as V;
  if (Array.isArray(value)) return value.map((item) => expandWorkspaceVars(item, workspaceRoot)) as V;
  if (value !== null && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(o)) out[key] = expandWorkspaceVars(o[key], workspaceRoot);
    return out as V;
  }
  return value;
}

export function readMcpConfig(): McpConfig | null {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) return null;

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const configPath = path.join(workspaceRoot, '.vscode', 'mcp.json');

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || !('servers' in parsed)) return null;
    const servers = (parsed as { servers: unknown }).servers;
    if (!servers || typeof servers !== 'object') return null;
    const cfg = parsed as McpConfig;
    const expandedServers: Record<string, McpServerConfig> = {};
    for (const key of Object.keys(cfg.servers)) {
      expandedServers[key] = expandWorkspaceVars(cfg.servers[key], workspaceRoot);
    }
    return { servers: expandedServers };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    if (err instanceof SyntaxError) {
      void vscode.window.showErrorMessage(
        `MCP Watchdog: invalid JSON in .vscode/mcp.json — ${err.message}`,
      );
      return null;
    }
    throw err;
  }
}

export function watchMcpConfig(onChange: () => void): vscode.Disposable {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) return { dispose: () => {} };

  const folder = workspaceFolders[0];
  const pattern = new vscode.RelativePattern(folder, '.vscode/mcp.json');
  const watcher = vscode.workspace.createFileSystemWatcher(pattern);
  watcher.onDidChange(onChange);
  watcher.onDidCreate(onChange);
  watcher.onDidDelete(onChange);
  return watcher;
}
