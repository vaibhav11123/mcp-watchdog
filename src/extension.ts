import * as vscode from 'vscode';
import { ServerMonitor, ServerStatus } from './monitor';
import { readMcpConfig, watchMcpConfig } from './config';
import { McpStatusBar } from './statusBar';
import { Logger } from './logger';
import { ServersTreeProvider } from './serversTree';

type StatusPickItem = vscode.QuickPickItem & { serverName: string };

let monitors = new Map<string, ServerMonitor>();
let statusBar: McpStatusBar;
let logger: Logger;
let statuses = new Map<string, ServerStatus>();
let serversTreeProvider: ServersTreeProvider | undefined;

function refreshAllUi(): void {
  statusBar.update([...statuses.values()]);
  serversTreeProvider?.refresh();
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  logger = new Logger();
  statusBar = new McpStatusBar('mcpWatchdog.showStatus');

  const serversTree = new ServersTreeProvider(() => [...statuses.values()]);
  serversTreeProvider = serversTree;
  const serversView = vscode.window.createTreeView('mcpWatchdog.servers', {
    treeDataProvider: serversTree,
  });

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
    vscode.commands.registerCommand('mcpWatchdog.focusServersView', async () => {
      await vscode.commands.executeCommand('workbench.view.extension.mcp-watchdog');
    }),
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

  const configWatcher = watchMcpConfig(async () => {
    logger.info('[Watchdog] mcp.json changed — reloading servers');
    await reloadServers();
  });
  context.subscriptions.push(configWatcher);

  await reloadServers();
}

async function reloadServers(): Promise<void> {
  for (const monitor of monitors.values()) {
    await monitor.stop();
  }
  monitors.clear();
  statuses.clear();

  const config = readMcpConfig();
  if (!config) {
    logger.info('[Watchdog] No .vscode/mcp.json found');
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
      (status) => {
        statuses.set(name, status);
        refreshAllUi();
      },
      logger.getLogFn(),
    );
    monitors.set(name, monitor);
    void monitor.start();
  }

  logger.info(`[Watchdog] Monitoring ${monitors.size} server(s)`);
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

async function reconnectAll(): Promise<void> {
  for (const monitor of monitors.values()) {
    await monitor.forceReconnect();
  }
}

async function reconnectServer(): Promise<void> {
  const names = [...monitors.keys()];
  if (names.length === 0) {
    void vscode.window.showInformationMessage('No MCP servers configured.');
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
    void vscode.window.showInformationMessage(
      'No MCP servers configured. Add servers to .vscode/mcp.json',
    );
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
