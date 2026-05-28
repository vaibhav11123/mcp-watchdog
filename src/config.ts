import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
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

export type McpConfigStatus =
  | { kind: 'no_workspace' }
  | { kind: 'no_config' }
  | { kind: 'empty_servers'; sources: string[] }
  | { kind: 'ok'; sources: string[] };

export interface McpConfigResult {
  status: McpConfigStatus;
  config: McpConfig | null;
}

const WORKSPACE_FOLDER = /\$\{workspaceFolder\}/g;

/** Same placeholder VS Code substitutes for MCP; watchdog reads JSON from disk, so expand explicitly. */
function expandWorkspaceVars<V>(value: V, workspaceRoot: string | undefined): V {
  if (!workspaceRoot) return value;
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

function extractServersBlock(parsed: unknown): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as Record<string, unknown>;
  const block = o.servers ?? o.mcpServers;
  if (!block || typeof block !== 'object' || Array.isArray(block)) return null;
  return block as Record<string, unknown>;
}

function normalizeServerEntry(entry: unknown): McpServerConfig | null {
  if (!entry || typeof entry !== 'object') return null;
  const e = entry as Record<string, unknown>;

  const explicitType = e.type;
  if (explicitType === 'http' || (typeof e.url === 'string' && e.url.length > 0)) {
    const url = typeof e.url === 'string' ? e.url : '';
    if (!url) return null;
    const headers =
      e.headers && typeof e.headers === 'object' && !Array.isArray(e.headers)
        ? (e.headers as Record<string, string>)
        : undefined;
    return { type: 'http', url, headers };
  }

  const command = typeof e.command === 'string' ? e.command : '';
  if (!command) return null;

  return {
    type: 'stdio',
    command,
    args: Array.isArray(e.args) ? (e.args as string[]) : undefined,
    env:
      e.env && typeof e.env === 'object' && !Array.isArray(e.env)
        ? (e.env as Record<string, string>)
        : undefined,
    cwd: typeof e.cwd === 'string' ? e.cwd : undefined,
  };
}

function readConfigFile(
  filePath: string,
  label: string,
  workspaceRoot: string | undefined,
): { servers: Record<string, McpServerConfig>; label: string } | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    const block = extractServersBlock(parsed);
    if (!block) return null;

    const servers: Record<string, McpServerConfig> = {};
    for (const key of Object.keys(block)) {
      const normalized = normalizeServerEntry(block[key]);
      if (normalized) {
        servers[key] = expandWorkspaceVars(normalized, workspaceRoot);
      }
    }
    return { servers, label };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    if (err instanceof SyntaxError) {
      void vscode.window.showErrorMessage(`MCP Watchdog: invalid JSON in ${label} — ${err.message}`);
      return null;
    }
    throw err;
  }
}

function mergeLayer(
  merged: Record<string, McpServerConfig>,
  sources: string[],
  layer: { servers: Record<string, McpServerConfig>; label: string } | null,
): void {
  if (!layer) return;
  sources.push(layer.label);
  Object.assign(merged, layer.servers);
}

/** Load MCP servers from VS Code + Cursor config paths (later layers override earlier). */
export function loadMcpConfig(): McpConfigResult {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    return { status: { kind: 'no_workspace' }, config: null };
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const merged: Record<string, McpServerConfig> = {};
  const sources: string[] = [];
  let anyFileFound = false;

  const globalPath = path.join(os.homedir(), '.cursor', 'mcp.json');
  const globalLayer = readConfigFile(globalPath, '~/.cursor/mcp.json', workspaceRoot);
  if (globalLayer) anyFileFound = true;
  mergeLayer(merged, sources, globalLayer);

  const vscodePath = path.join(workspaceRoot, '.vscode', 'mcp.json');
  const vscodeLayer = readConfigFile(vscodePath, '.vscode/mcp.json', workspaceRoot);
  if (vscodeLayer) anyFileFound = true;
  mergeLayer(merged, sources, vscodeLayer);

  const cursorPath = path.join(workspaceRoot, '.cursor', 'mcp.json');
  const cursorLayer = readConfigFile(cursorPath, '.cursor/mcp.json', workspaceRoot);
  if (cursorLayer) anyFileFound = true;
  mergeLayer(merged, sources, cursorLayer);

  if (!anyFileFound) {
    return { status: { kind: 'no_config' }, config: null };
  }

  if (Object.keys(merged).length === 0) {
    return { status: { kind: 'empty_servers', sources }, config: { servers: {} } };
  }

  return {
    status: { kind: 'ok', sources: [...new Set(sources)] },
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
      vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, '.vscode/mcp.json')),
      vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, '.cursor/mcp.json')),
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

export function emptyViewMessage(status: McpConfigStatus): string {
  switch (status.kind) {
    case 'no_workspace':
      return 'Open a folder to monitor MCP servers.';
    case 'no_config':
      return 'Add MCP config: .vscode/mcp.json (VS Code) or .cursor/mcp.json (Cursor). Global: ~/.cursor/mcp.json';
    case 'empty_servers':
      return 'mcp.json found but no valid servers. Use a "servers" or "mcpServers" object with stdio (command) or http (url) entries.';
    default:
      return '';
  }
}
