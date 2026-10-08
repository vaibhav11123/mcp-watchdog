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

/** VS Code user-profile MCP config (platform-specific). */
export function vscodeUserMcpPath(home = os.homedir(), platform = process.platform): string {
  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Code', 'User', 'mcp.json');
  }
  if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(appData, 'Code', 'User', 'mcp.json');
  }
  return path.join(home, '.config', 'Code', 'User', 'mcp.json');
}

/** Windsurf (Codeium) global MCP config. */
export function windsurfMcpPath(home = os.homedir()): string {
  return path.join(home, '.codeium', 'windsurf', 'mcp_config.json');
}

/** Claude Code global config (`mcpServers` in ~/.claude.json). */
export function claudeCodeMcpPath(home = os.homedir()): string {
  return path.join(home, '.claude.json');
}

function readConfigFile(
  filePath: string,
  label: string,
  workspaceRoot: string | undefined,
): { servers: Record<string, McpServerConfig>; label: string } | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseConfigFile(raw, workspaceRoot, {
      userHome: os.homedir(),
      env: process.env,
    });
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

/**
 * Load MCP servers from editor config paths (later layers override earlier).
 *
 * Merge order (lowest → highest priority):
 * 1. VS Code user `mcp.json`
 * 2. Windsurf `~/.codeium/windsurf/mcp_config.json`
 * 3. Claude Code `~/.claude.json` (`mcpServers`)
 * 4. Cursor global `~/.cursor/mcp.json`
 * 5–N. For each workspace folder (in order): `.vscode/mcp.json` then `.cursor/mcp.json`
 *     (labels include the folder name, e.g. `app/.cursor/mcp.json`)
 *
 * Global layers expand `${workspaceFolder}` using the **first** folder only.
 * Each workspace layer expands using that folder’s path.
 * Same server name across folders: later folder wins.
 */
export function loadMcpConfig(): McpConfigResult {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    return { status: { kind: 'no_workspace' }, config: null };
  }

  const home = os.homedir();
  const primaryRoot = workspaceFolders[0].uri.fsPath;
  const layers = [
    readConfigFile(vscodeUserMcpPath(home), 'VS Code user mcp.json', primaryRoot),
    readConfigFile(windsurfMcpPath(home), 'Windsurf mcp_config.json', primaryRoot),
    readConfigFile(claudeCodeMcpPath(home), 'Claude Code (~/.claude.json)', primaryRoot),
    readConfigFile(path.join(home, '.cursor', 'mcp.json'), '~/.cursor/mcp.json', primaryRoot),
  ];

  for (const folder of workspaceFolders) {
    const root = folder.uri.fsPath;
    const folderLabel = folder.name;
    layers.push(
      readConfigFile(
        path.join(root, '.vscode', 'mcp.json'),
        `${folderLabel}/.vscode/mcp.json`,
        root,
      ),
      readConfigFile(
        path.join(root, '.cursor', 'mcp.json'),
        `${folderLabel}/.cursor/mcp.json`,
        root,
      ),
    );
  }

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

function watchGlobalFile(filePath: string): vscode.FileSystemWatcher {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  if (fs.existsSync(dir)) {
    return vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.Uri.file(dir), base),
    );
  }
  return vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(
      vscode.Uri.file(os.homedir()),
      path.relative(os.homedir(), filePath),
    ),
  );
}

export function watchMcpConfig(onChange: () => void): vscode.Disposable {
  const watchers: vscode.FileSystemWatcher[] = [];
  const home = os.homedir();

  watchers.push(
    watchGlobalFile(vscodeUserMcpPath(home)),
    watchGlobalFile(windsurfMcpPath(home)),
    watchGlobalFile(claudeCodeMcpPath(home)),
  );

  const globalDir = path.join(home, '.cursor');
  if (fs.existsSync(globalDir)) {
    watchers.push(
      vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(vscode.Uri.file(globalDir), 'mcp.json'),
      ),
    );
  } else {
    watchers.push(
      vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(vscode.Uri.file(home), '.cursor/mcp.json'),
      ),
    );
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders?.length) {
    for (const folder of workspaceFolders) {
      watchers.push(
        vscode.workspace.createFileSystemWatcher(
          new vscode.RelativePattern(folder, '.vscode/mcp.json'),
        ),
        vscode.workspace.createFileSystemWatcher(
          new vscode.RelativePattern(folder, '.cursor/mcp.json'),
        ),
      );
    }
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
