import * as vscode from 'vscode';
import { ServerMonitor, ServerStatus } from './monitor';
import {
  emptyViewMessage,
  loadMcpConfig,
  McpConfigStatus,
  watchMcpConfig,
} from './config';
import { McpStatusBar } from './statusBar';
import { Logger } from './logger';
import { ServersTreeProvider } from './serversTree';

type StatusPickItem = vscode.QuickPickItem & { serverName: string };

let monitors = new Map<string, ServerMonitor>();
let statusBar: McpStatusBar;
let logger: Logger;
let statuses = new Map<string, ServerStatus>();
let serversTreeProvider: ServersTreeProvider | undefined;
let serversView: vscode.TreeView<vscode.TreeItem> | undefined;
let lastConfigStatus: McpConfigStatus = { kind: 'no_workspace' };
let configWatcher: vscode.Disposable | undefined;

function refreshAllUi(): void {
  statusBar.update([...statuses.values()]);
  serversTreeProvider?.refresh();
  if (serversView) {
    serversView.message = emptyViewMessage(lastConfigStatus);
  }
}

function resetConfigWatcher(): void {
  configWatcher?.dispose();
  configWatcher = watchMcpConfig(() => {
    logger.info('[Watchdog] MCP config changed — reloading servers');
    void reloadServers();
  });
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  logger = new Logger();
  statusBar = new McpStatusBar('mcpWatchdog.showStatus');

  const serversTree = new ServersTreeProvider(() => [...statuses.values()]);
  serversTreeProvider = serversTree;
  serversView = vscode.window.createTreeView('mcpWatchdog.servers', {
    treeDataProvider: serversTree,
  });
  serversView.message = emptyViewMessage({ kind: 'no_workspace' });

  context.subscriptions.push(logger, statusBar, serversView);

  context.subscriptions.push(
    vscode.commands.registerCommand('mcpWatchdog.showStatus', showStatusPanel),
    vscode.commands.registerCommand('mcpWatchdog.reconnectAll', reconnectAll),
    vscode.commands.registerCommand('mcpWatchdog.reconnectServer', reconnectServer),
    vscode.commands.registerCommand('mcpWatchdog.reconnectOne', async (name: string) => {
      if (typeof name === 'string') {
        await monitors.get(name)?.forceReconnect();
      }
    }),
    vscode.commands.registerCommand('mcpWatchdog.focusServersView', focusServersView),
    vscode.commands.registerCommand('mcpWatchdog.openMcpConfig', openMcpConfig),
  );

  context.subscriptions.push(
    vscode.window.onDidChangeWindowState((state) => {
      if (state.focused) {
        logger.info('[Watchdog] Window focus restored — running health checks');
        for (const monitor of monitors.values()) {
          monitor.wakeUp();
        }
      }
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      resetConfigWatcher();
      void reloadServers();
    }),
  );

  resetConfigWatcher();
  context.subscriptions.push({ dispose: () => configWatcher?.dispose() });

  await reloadServers();

  const revealKey = 'mcpWatchdog.didRevealServersView';
  if (!context.globalState.get<boolean>(revealKey)) {
    void context.globalState.update(revealKey, true);
    setTimeout(() => void focusServersView(), 750);
  }
}

async function focusServersView(): Promise<void> {
  await vscode.commands.executeCommand('mcpWatchdog.servers.focus');
}

async function reloadServers(): Promise<void> {
  for (const monitor of monitors.values()) {
    await monitor.stop();
  }
  monitors.clear();
  statuses.clear();

  const { status, config } = loadMcpConfig();
  lastConfigStatus = status;

  if (!config || status.kind !== 'ok') {
    const detail =
      status.kind === 'no_config'
        ? 'No MCP config file found'
        : status.kind === 'empty_servers'
          ? 'No valid server entries in mcp.json'
          : status.kind === 'no_workspace'
            ? 'No workspace folder open'
            : 'MCP config not loaded';
    logger.info(`[Watchdog] ${detail}`);
    statusBar.update([]);
    refreshAllUi();
    return;
  }

  const opts = getOptions();

  for (const [name, serverConfig] of Object.entries(config.servers)) {
    const monitor = new ServerMonitor(
      name,
      serverConfig,
      opts,
      (s) => {
        statuses.set(name, s);
        refreshAllUi();
      },
      logger.getLogFn(),
    );
    monitors.set(name, monitor);
    void monitor.start();
  }

  if (status.kind === 'ok') {
    logger.info(`[Watchdog] Monitoring ${monitors.size} server(s) from ${status.sources.join(', ')}`);
  } else {
    logger.info(`[Watchdog] Monitoring ${monitors.size} server(s)`);
  }
  refreshAllUi();
}

function getOptions() {
  const cfg = vscode.workspace.getConfiguration('mcpWatchdog');
  return {
    pingIntervalMs: cfg.get<number>('pingIntervalMs', 30000),
    maxRetries: cfg.get<number>('maxRetries', 5),
    initialBackoffMs: cfg.get<number>('initialBackoffMs', 1000),
    backoffMultiplier: cfg.get<number>('backoffMultiplier', 1.5),
    maxBackoffMs: cfg.get<number>('maxBackoffMs', 30000),
  };
}

async function openMcpConfig(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    void vscode.window.showInformationMessage('Open a folder first, then add .vscode/mcp.json or .cursor/mcp.json.');
    return;
  }

  const root = folders[0].uri;
  const candidates = [
    vscode.Uri.joinPath(root, '.cursor', 'mcp.json'),
    vscode.Uri.joinPath(root, '.vscode', 'mcp.json'),
  ];

  for (const uri of candidates) {
    try {
      await vscode.workspace.fs.stat(uri);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc);
      return;
    } catch {
      // try next
    }
  }

  const pick = await vscode.window.showQuickPick(
    [
      { label: 'Cursor project config', path: '.cursor/mcp.json', description: 'Recommended for Cursor' },
      { label: 'VS Code workspace config', path: '.vscode/mcp.json', description: 'Recommended for VS Code' },
    ],
    { placeHolder: 'Create MCP config file' },
  );
  if (!pick) return;

  const uri = vscode.Uri.joinPath(root, ...pick.path.split('/'));
  const template =
    pick.path.includes('.cursor')
      ? '{\n  "mcpServers": {\n    "example": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-memory"]\n    }\n  }\n}\n'
      : '{\n  "servers": {\n    "example": {\n      "type": "stdio",\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-memory"]\n    }\n  }\n}\n';

  await vscode.workspace.fs.writeFile(uri, Buffer.from(template, 'utf8'));
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc);
  void vscode.window.showInformationMessage('MCP config created. Save the file and reload the window.');
}

async function reconnectAll(): Promise<void> {
  for (const monitor of monitors.values()) {
    await monitor.forceReconnect();
  }
}

async function reconnectServer(): Promise<void> {
  const names = [...monitors.keys()];
  if (names.length === 0) {
    void vscode.window.showInformationMessage(
      'No MCP servers configured. Add .vscode/mcp.json or .cursor/mcp.json, or run "MCP Watchdog: Open MCP Config".',
    );
    return;
  }
  const picked = await vscode.window.showQuickPick(names, {
    placeHolder: 'Select a server to reconnect',
  });
  if (picked) {
    await monitors.get(picked)?.forceReconnect();
  }
}

async function showStatusPanel(): Promise<void> {
  if (statuses.size === 0) {
    const msg =
      lastConfigStatus.kind === 'no_workspace'
        ? 'Open a workspace folder first.'
        : lastConfigStatus.kind === 'no_config'
          ? 'No MCP config found. Use "MCP Watchdog: Open MCP Config" or add .cursor/mcp.json / .vscode/mcp.json.'
          : 'No MCP servers configured or all entries were invalid.';
    void vscode.window.showInformationMessage(msg);
    return;
  }

  const iconMap: Record<string, string> = {
    healthy: '✓',
    connecting: '⟳',
    degraded: '⚠',
    failed: '✗',
    disconnected: '○',
  };

  const items: StatusPickItem[] = [...statuses.values()].map((s) => {
    const icon = iconMap[s.state];
    const ping = s.lastPingMs !== undefined ? ` (${s.lastPingMs}ms)` : '';
    return {
      label: `${icon} ${s.name}`,
      description: s.state + ping,
      detail: s.lastError,
      serverName: s.name,
    };
  });

  const item = await vscode.window.showQuickPick<StatusPickItem>(items, {
    placeHolder: 'MCP Server Status — pick a server to reconnect',
    canPickMany: false,
  });
  if (!item) return;
  await monitors.get(item.serverName)?.forceReconnect();
  void vscode.window.showInformationMessage(`Reconnecting ${item.serverName}...`);
}

export async function deactivate(): Promise<void> {
  for (const monitor of monitors.values()) {
    await monitor.stop();
  }
}
