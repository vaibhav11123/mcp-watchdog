import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  emptyViewMessage,
  mergeConfigLayers,
  parseConfigFile,
  type McpConfig,
  type McpConfigResult,
  type McpConfigStatus,
  type McpServerConfig,
} from './config-core';

export type { McpConfig, McpConfigResult, McpConfigStatus, McpServerConfig };
export { emptyViewMessage };

function readConfigFile(
  filePath: string,
  label: string,
  workspaceRoot: string | undefined,
): { servers: Record<string, McpServerConfig>; label: string } | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseConfigFile(raw, workspaceRoot);
    if (!parsed.ok) {
      if (parsed.error === 'syntax') {
        void vscode.window.showErrorMessage(`MCP Watchdog: invalid JSON in ${label}`);
      }
      return null;
    }
    return { servers: parsed.servers, label };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

/** Load MCP servers from VS Code + Cursor config paths (later layers override earlier). */
export function loadMcpConfig(): McpConfigResult {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    return { status: { kind: 'no_workspace' }, config: null };
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const layers = [
    readConfigFile(
      path.join(os.homedir(), '.cursor', 'mcp.json'),
      '~/.cursor/mcp.json',
      workspaceRoot,
    ),
    readConfigFile(
      path.join(workspaceRoot, '.vscode', 'mcp.json'),
      '.vscode/mcp.json',
      workspaceRoot,
    ),
    readConfigFile(
      path.join(workspaceRoot, '.cursor', 'mcp.json'),
      '.cursor/mcp.json',
      workspaceRoot,
    ),
  ];

  const anyFileFound = layers.some((l) => l !== null);
  if (!anyFileFound) {
    return { status: { kind: 'no_config' }, config: null };
  }

  const { merged, sources } = mergeConfigLayers(layers);
  if (Object.keys(merged).length === 0) {
    return { status: { kind: 'empty_servers', sources }, config: { servers: {} } };
  }

  return {
    status: { kind: 'ok', sources },
    config: { servers: merged },
  };
}

/** @deprecated Use loadMcpConfig() */
export function readMcpConfig(): McpConfig | null {
  return loadMcpConfig().config;
}

export function watchMcpConfig(onChange: () => void): vscode.Disposable {
  const watchers: vscode.FileSystemWatcher[] = [];

  const globalDir = path.join(os.homedir(), '.cursor');
  if (fs.existsSync(globalDir)) {
    watchers.push(
      vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(vscode.Uri.file(globalDir), 'mcp.json'),
      ),
    );
  } else {
    watchers.push(
      vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(vscode.Uri.file(os.homedir()), '.cursor/mcp.json'),
      ),
    );
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders?.length) {
    const folder = workspaceFolders[0];
    watchers.push(
      vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(folder, '.vscode/mcp.json'),
      ),
      vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(folder, '.cursor/mcp.json'),
      ),
    );
  }

  for (const watcher of watchers) {
    watcher.onDidChange(onChange);
    watcher.onDidCreate(onChange);
    watcher.onDidDelete(onChange);
  }

  return {
    dispose: () => {
      for (const w of watchers) w.dispose();
    },
  };
}
