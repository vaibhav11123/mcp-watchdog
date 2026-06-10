import * as vscode from 'vscode';
import { ServerMonitor, ServerStatus, ServerState } from './monitor';
import { emptyViewMessage, loadMcpConfig, McpConfigStatus, watchMcpConfig } from './config';
import type { McpServerConfig } from './config-core';
import { McpStatusBar } from './statusBar';
import { Logger } from './logger';
import { ServersTreeProvider } from './serversTree';
import { OverviewViewProvider } from './overviewView';
import { STATE_PRESENTATION } from './ui/statePresentation';
import { computeServerSetFingerprint, formatServerSummary, TrustStore } from './trust';
import { AlertManager, type AlertDecision } from './alerts';
import { debounce, resolveServerOptions, type MonitorOptions } from './options';

type StatusPickItem = vscode.QuickPickItem & { serverName: string };

const monitors = new Map<string, ServerMonitor>();
let statusBar: McpStatusBar;
let logger: Logger;
const statuses = new Map<string, ServerStatus>();
let serversTreeProvider: ServersTreeProvider | undefined;
let overviewProvider: OverviewViewProvider | undefined;
let serversView: vscode.TreeView<vscode.TreeItem> | undefined;
let lastConfigStatus: McpConfigStatus = { kind: 'no_workspace' };
let configWatcher: vscode.Disposable | undefined;
let trustStore: TrustStore;
let extensionContext: vscode.ExtensionContext;
let pendingServers: Record<string, McpServerConfig> | null = null;
let pendingFingerprint: string | null = null;
let trustPromptShown = false;
let alertManager: AlertManager;
let lastAlertForTest: AlertDecision | undefined;

function workspacePath(): string {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
}

function refreshAllUi(): void {
  const list = [...statuses.values()];
  statusBar.update(list, lastConfigStatus);
  serversTreeProvider?.refresh();
  overviewProvider?.update(list, lastConfigStatus);
  if (serversView) {
    serversView.message = emptyViewMessage(lastConfigStatus);
  }
}

function resetConfigWatcher(): void {
  configWatcher?.dispose();
  configWatcher = watchMcpConfig(() => {
    logger.info('[Watchdog] MCP config changed — reloading servers');
    trustPromptShown = false;
    void reloadServers();
  });
}

function requireApproval(): boolean {
  return vscode.workspace.getConfiguration('mcpWatchdog').get<boolean>('requireApproval', true);
}

function setUntrustedPlaceholders(
  servers: Record<string, McpServerConfig>,
  sources: string[],
): void {
  lastConfigStatus = {
    kind: 'untrusted',
    sources,
    serverCount: Object.keys(servers).length,
  };
  for (const name of Object.keys(servers)) {
    statuses.set(name, {
      name,
      state: 'disconnected',
      retryCount: 0,
      lastError: 'Awaiting approval',
    });
  }
}

function onServerStatus(name: string, s: ServerStatus): void {
  const withFlap = { ...s, flapping: alertManager.getFlapping(name) };
  statuses.set(name, withFlap);
  alertManager.onStatusChange(withFlap);
  statuses.set(name, { ...withFlap, flapping: alertManager.getFlapping(name) });
  refreshAllUi();
}

function startMonitor(name: string, serverConfig: McpServerConfig, opts: MonitorOptions): void {
  const monitor = new ServerMonitor(
    name,
    serverConfig,
    opts,
    (s) => onServerStatus(name, s),
    logger.getLogFn(),
  );
  monitors.set(name, monitor);
  void monitor.start();
}

async function emitAlert(decision: AlertDecision): Promise<void> {
  lastAlertForTest = decision;
  const show =
    decision.kind === 'error'
      ? vscode.window.showErrorMessage
      : decision.kind === 'warning' || decision.kind === 'flap'
        ? vscode.window.showWarningMessage
        : vscode.window.showInformationMessage;

  const picked = await show(decision.message, ...decision.actions);
  if (!picked) return;

  if (picked === 'Reconnect') {
    await monitors.get(decision.server)?.forceReconnect();
  } else if (picked === 'Show Log') {
    logger.show();
    const recent = monitors.get(decision.server)?.getRecentLog() ?? [];
    if (recent.length > 0) {
      logger.info(`--- recent ${decision.server} history ---`);
      for (const line of recent) logger.info(line);
    }
  } else if (picked === 'Reload Window') {
    await vscode.commands.executeCommand('workbench.action.reloadWindow');
  } else if (picked === 'Mute 1h') {
    alertManager.mute(decision.server, 60 * 60 * 1000);
  }
}

async function offerTrustPrompt(): Promise<void> {
  if (!pendingServers || !pendingFingerprint) {
    const { status, config } = loadMcpConfig();
    if (!config || status.kind !== 'ok') {
      return;
    }
    pendingServers = config.servers;
    pendingFingerprint = computeServerSetFingerprint(config.servers);
  }

  const count = Object.keys(pendingServers).length;
  const choice = await vscode.window.showInformationMessage(
    `MCP Watchdog: monitor ${count} MCP server(s)? This connects to them (stdio commands / HTTP URLs).`,
    'Review & Allow',
    'Not now',
  );

  if (choice === 'Review & Allow') {
    await reviewTrustQuickPick();
  }
}

async function reviewTrustQuickPick(): Promise<void> {
  const { status, config } = loadMcpConfig();
  if (!config || status.kind !== 'ok') {
    void vscode.window.showInformationMessage('No MCP servers to review.');
    return;
  }

  const servers = config.servers;
  const fingerprint = computeServerSetFingerprint(servers);
  const approval = trustStore.get();
  const preselected =
    approval?.fingerprint === fingerprint
      ? new Set(approval.allowedServers)
      : new Set(Object.keys(servers));

  const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem & { serverName: string }>();
  quickPick.canSelectMany = true;
  quickPick.title = 'MCP Watchdog: Trusted Servers';
  quickPick.placeholder = 'Select servers to monitor. Confirm with none selected to revoke trust.';
  quickPick.items = Object.entries(servers).map(([name, cfg]) => ({
    label: `${name} — ${formatServerSummary(cfg)}`,
    serverName: name,
  }));
  quickPick.selectedItems = quickPick.items.filter((item) => preselected.has(item.serverName));

  const selected = await new Promise<typeof quickPick.selectedItems | undefined>((resolve) => {
    quickPick.onDidAccept(() => {
      resolve(quickPick.selectedItems);
      quickPick.hide();
    });
    quickPick.onDidHide(() => {
      resolve(undefined);
      quickPick.dispose();
    });
    quickPick.show();
  });

  if (selected === undefined) {
    return;
  }

  if (selected.length === 0) {
    await trustStore.revoke();
    logger.info('[Watchdog] Trust revoked for this workspace');
    void vscode.window.showInformationMessage('MCP Watchdog: trust revoked for this workspace.');
    trustPromptShown = false;
    await reloadServers();
    return;
  }

  const allowed = selected.map((item) => item.serverName);
  await trustStore.approve(fingerprint, allowed);
  logger.info(`[Watchdog] Approved monitoring ${allowed.length} server(s)`);
  trustPromptShown = false;
  await reloadServers();
}

export interface McpWatchdogApi {
  getStatuses(): ServerStatus[];
  /** Host-test hook: last alert decision emitted (before user picks an action). */
  getLastAlert(): AlertDecision | undefined;
  revokeTrustForTests(): Promise<void>;
}

export async function activate(context: vscode.ExtensionContext): Promise<McpWatchdogApi> {
  extensionContext = context;
  trustStore = new TrustStore(context.globalState, workspacePath());

  logger = new Logger();
  alertManager = new AlertManager(
    () =>
      vscode.workspace
        .getConfiguration('mcpWatchdog')
        .get<'all' | 'failures' | 'none'>('notify', 'failures'),
    (decision) => void emitAlert(decision),
    () => Date.now(),
    () =>
      vscode.workspace.getConfiguration('mcpWatchdog').get<number>('degradedAlertDelayMs', 60_000),
  );
  statusBar = new McpStatusBar('mcpWatchdog.showStatus');

  overviewProvider = new OverviewViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('mcpWatchdog.overview', overviewProvider),
  );

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
    vscode.commands.registerCommand('mcpWatchdog.reconnectOne', async (arg: unknown) => {
      const name =
        typeof arg === 'string'
          ? arg
          : arg && typeof arg === 'object' && 'serverName' in arg
            ? String((arg as { serverName: string }).serverName)
            : undefined;
      if (name) await monitors.get(name)?.forceReconnect();
    }),
    vscode.commands.registerCommand('mcpWatchdog.focusServersView', focusServersView),
    vscode.commands.registerCommand('mcpWatchdog.openMcpConfig', openMcpConfig),
    vscode.commands.registerCommand('mcpWatchdog.showOutput', () => logger.show()),
    vscode.commands.registerCommand('mcpWatchdog.refresh', () => reloadServers()),
    vscode.commands.registerCommand('mcpWatchdog.reviewTrust', reviewTrustQuickPick),
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
      trustStore = new TrustStore(extensionContext.globalState, workspacePath());
      resetConfigWatcher();
      trustPromptShown = false;
      void reloadServers();
    }),
  );

  resetConfigWatcher();
  context.subscriptions.push({ dispose: () => configWatcher?.dispose() });

  const debouncedSettingsReload = debounce(() => {
    logger.info('[Watchdog] Settings changed — reloading servers');
    void reloadServers();
  }, 500);
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('mcpWatchdog')) {
        debouncedSettingsReload();
      }
    }),
  );

  await reloadServers();

  const revealKey = 'mcpWatchdog.didRevealServersView';
  if (!context.globalState.get<boolean>(revealKey)) {
    void context.globalState.update(revealKey, true);
    setTimeout(() => void focusServersView(), 750);
  }

  return {
    getStatuses: () => [...statuses.values()],
    getLastAlert: () => lastAlertForTest,
    revokeTrustForTests: async () => {
      await trustStore.revoke();
      trustPromptShown = false;
      await reloadServers();
    },
  };
}

async function focusServersView(): Promise<void> {
  await vscode.commands.executeCommand('workbench.view.extension.mcp-watchdog');
  await vscode.commands.executeCommand('mcpWatchdog.overview.focus');
}

async function reloadServers(): Promise<void> {
  for (const monitor of monitors.values()) {
    await monitor.stop();
  }
  for (const name of monitors.keys()) {
    alertManager.clearServer(name);
  }
  monitors.clear();
  statuses.clear();

  trustStore = new TrustStore(extensionContext.globalState, workspacePath());

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
    pendingServers = null;
    pendingFingerprint = null;
    statusBar.update([]);
    refreshAllUi();
    return;
  }

  const fingerprint = computeServerSetFingerprint(config.servers);
  pendingServers = config.servers;
  pendingFingerprint = fingerprint;
  const opts = getOptions();

  if (requireApproval()) {
    const approval = trustStore.get();
    const trusted = approval?.fingerprint === fingerprint ? new Set(approval.allowedServers) : null;

    if (!trusted) {
      setUntrustedPlaceholders(config.servers, status.sources);
      logger.info(
        `[Watchdog] ${Object.keys(config.servers).length} server(s) awaiting trust approval`,
      );
      refreshAllUi();
      if (!trustPromptShown) {
        trustPromptShown = true;
        void offerTrustPrompt();
      }
      return;
    }

    for (const [name, serverConfig] of Object.entries(config.servers)) {
      if (!trusted.has(name)) {
        statuses.set(name, {
          name,
          state: 'disconnected',
          retryCount: 0,
          lastError: 'Not in trusted subset',
        });
        continue;
      }
      startServer(name, serverConfig, opts);
    }
    lastConfigStatus = status;
  } else {
    for (const [name, serverConfig] of Object.entries(config.servers)) {
      startServer(name, serverConfig, opts);
    }
    lastConfigStatus = status;
  }

  logger.info(`[Watchdog] Monitoring ${monitors.size} server(s) from ${status.sources.join(', ')}`);
  refreshAllUi();
}

function getOptions(): MonitorOptions {
  const cfg = vscode.workspace.getConfiguration('mcpWatchdog');
  return {
    probeMode: cfg.get<'interval' | 'persistent'>('probeMode', 'interval'),
    pingIntervalMs: cfg.get<number>('pingIntervalMs', 30000),
    pingTimeoutMs: cfg.get<number>('pingTimeoutMs', 5000),
    maxRetries: cfg.get<number>('maxRetries', 5),
    initialBackoffMs: cfg.get<number>('initialBackoffMs', 1000),
    backoffMultiplier: cfg.get<number>('backoffMultiplier', 1.5),
    maxBackoffMs: cfg.get<number>('maxBackoffMs', 30000),
  };
}

function getPerServerOverrides(): Record<string, import('./options').PerServerOverride> {
  return vscode.workspace.getConfiguration('mcpWatchdog').get('perServer', {});
}

function startServer(name: string, serverConfig: McpServerConfig, globals: MonitorOptions): void {
  const { enabled, options } = resolveServerOptions(globals, getPerServerOverrides(), name);
  if (!enabled) {
    statuses.set(name, {
      name,
      state: 'disconnected',
      retryCount: 0,
      disabled: true,
      probeMode: options.probeMode,
    });
    return;
  }
  startMonitor(name, serverConfig, options);
}

async function openMcpConfig(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    void vscode.window.showInformationMessage(
      'Open a folder first, then add .vscode/mcp.json or .cursor/mcp.json.',
    );
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
      {
        label: 'Cursor project config',
        path: '.cursor/mcp.json',
        description: 'Recommended for Cursor',
      },
      {
        label: 'VS Code workspace config',
        path: '.vscode/mcp.json',
        description: 'Recommended for VS Code',
      },
    ],
    { placeHolder: 'Create MCP config file' },
  );
  if (!pick) return;

  const uri = vscode.Uri.joinPath(root, ...pick.path.split('/'));
  const template = pick.path.includes('.cursor')
    ? '{\n  "mcpServers": {\n    "example": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-memory"]\n    }\n  }\n}\n'
    : '{\n  "servers": {\n    "example": {\n      "type": "stdio",\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-memory"]\n    }\n  }\n}\n';

  await vscode.workspace.fs.writeFile(uri, Buffer.from(template, 'utf8'));
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc);
  void vscode.window.showInformationMessage(
    'MCP config created. Save the file to start monitoring.',
  );
}

async function reconnectAll(): Promise<void> {
  if (lastConfigStatus.kind === 'untrusted') {
    await offerTrustPrompt();
    return;
  }
  for (const monitor of monitors.values()) {
    await monitor.forceReconnect();
  }
  void vscode.window.showInformationMessage('MCP Watchdog: reconnecting all servers…');
}

async function reconnectServer(): Promise<void> {
  if (lastConfigStatus.kind === 'untrusted') {
    await offerTrustPrompt();
    return;
  }
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

const QUICK_PICK_ICON: Record<ServerState, string> = {
  healthy: '$(check)',
  connecting: '$(sync~spin)',
  degraded: '$(warning)',
  failed: '$(error)',
  disconnected: '$(circle-slash)',
};

async function showStatusPanel(): Promise<void> {
  if (lastConfigStatus.kind === 'untrusted') {
    await offerTrustPrompt();
    return;
  }

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

  const items: StatusPickItem[] = [...statuses.values()].map((s) => {
    const ping = s.lastPingMs !== undefined ? ` · ${s.lastPingMs} ms` : '';
    return {
      label: `${QUICK_PICK_ICON[s.state]} ${s.name}`,
      description: `${STATE_PRESENTATION[s.state].label}${ping}`,
      detail: s.lastError,
      serverName: s.name,
    };
  });

  const item = await vscode.window.showQuickPick<StatusPickItem>(items, {
    placeHolder: 'MCP servers — select to reconnect',
    canPickMany: false,
  });
  if (!item) return;
  await monitors.get(item.serverName)?.forceReconnect();
  void vscode.window.showInformationMessage(`Reconnecting ${item.serverName}…`);
}

export async function deactivate(): Promise<void> {
  for (const monitor of monitors.values()) {
    await monitor.stop();
  }
}
