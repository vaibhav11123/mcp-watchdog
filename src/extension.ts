import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { ServerMonitor, ServerStatus, ServerState } from './monitor';
import { emptyViewMessage, loadMcpConfig, McpConfigStatus, watchMcpConfig } from './config';
import type { McpServerConfig, ServerOrigin } from './config-core';
import { McpStatusBar } from './statusBar';
import { Logger } from './logger';
import { ServersTreeProvider } from './serversTree';
import { OverviewViewProvider } from './overviewView';
import { STATE_PRESENTATION } from './ui/statePresentation';
import { computeServerSetFingerprint, formatServerSummary, TrustStore } from './trust';
import { AlertManager, type AlertDecision } from './alerts';
import { debounce, resolveServerOptions, type MonitorOptions } from './options';
import { ConfigDiagnostics } from './configDiagnostics';
import { IncidentRingBuffer } from './incidents';
import { LatencyHistory } from './latencyHistory';
import {
  RESTART_EDITOR_MCP_ACTION,
  editorMcpCommandsAvailable,
  failureAlertActionsWithEditorMcp,
  tryRestartEditorMcp,
  type EditorMcpHost,
} from './editorMcp';
import {
  acceptedFailuresStorageKey,
  normalizeAcceptedList,
  statusesForChip,
} from './failureTriage';
import { buildBridgePayload, postBridgeIncident, workspaceIdHash } from './cloudBridge';
import { mergeCredentialOverlay, secretStorageKey } from './credentialOverlay';
import { awsProfileFromEnv, matchRecipe } from './vendorRecipes';
import { resolveServerArg, runFixFailure, runRemoveServer } from './triageHost';
import { classifyFailure, diagnoseFailure } from './failureTriage';
import {
  resolveHostCapabilities,
  type HostCapabilities,
} from './hostCapabilities';
import { DoctorMetrics } from './incidentStore';
import type { VerifiedOutcome } from './verifyRecovery';
import * as telemetry from './telemetry/client';

import type {
  ProbeModeSnapshot,
  TransportKind,
  TriageSurface,
  UiCommandName,
} from './telemetry/events';
import {
  disposeGithubStar,
  initGithubStar,
  notifyValueMoment,
  registerStarCommand,
} from './githubStar';

function trackUi(command: UiCommandName): void {
  telemetry.track('ui_command', { command });
}

function trackTriage(
  props: Omit<Parameters<typeof telemetry.track<'triage_action'>>[1], 'surface'> & {
    surface: TriageSurface;
  },
): void {
  telemetry.track('triage_action', props);
}

type StatusPickItem = vscode.QuickPickItem & { serverName: string };

const vscodeEditorMcpHost: EditorMcpHost = {
  getCommands: (filterInternal) => vscode.commands.getCommands(filterInternal),
  executeCommand: (command, ...rest) => vscode.commands.executeCommand(command, ...rest),
};

let editorMcpHintShown = false;

const ASKED_REVIEW_KEY = 'mcpWatchdog.askedReview';
const RECOVERY_COUNT_KEY = 'mcpWatchdog.recoveryCount';
const OPEN_VSX_REVIEW = 'https://open-vsx.org/extension/mcp-watchdog/mcp-watchdog';
const MARKETPLACE_REVIEW =
  'https://marketplace.visualstudio.com/items?itemName=mcp-watchdog.mcp-watchdog';

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
let configDiagnostics: ConfigDiagnostics | undefined;
const incidentBuffer = new IncidentRingBuffer();
const latencyHistory = new LatencyHistory();
let serverOrigins: Record<string, ServerOrigin> = {};
let serverConfigs: Record<string, McpServerConfig> = {};
const watchdogOnlyCred = new Set<string>();
let bridgeFailLogged = false;
let acceptedNames = new Set<string>();
let hostCaps: HostCapabilities | undefined;
const doctorMetrics = new DoctorMetrics();


/** Joined sorted folder paths — trust key covers the full multi-root workspace. */
function workspacePath(): string {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) return '';
  return folders
    .map((f) => f.uri.fsPath)
    .sort()
    .join('\0');
}

function loadAcceptedFromState(): void {
  acceptedNames = new Set(
    normalizeAcceptedList(extensionContext.workspaceState.get(acceptedFailuresStorageKey())),
  );
}

async function persistAccepted(): Promise<void> {
  await extensionContext.workspaceState.update(
    acceptedFailuresStorageKey(),
    [...acceptedNames].sort(),
  );
}

function annotateStatuses(list: ServerStatus[]): ServerStatus[] {
  return list.map((s) => ({
    ...s,
    accepted: acceptedNames.has(s.name),
    watchdogOnlyCred: watchdogOnlyCred.has(s.name) || undefined,
  }));
}

function refreshAllUi(): void {
  const list = annotateStatuses([...statuses.values()]);
  statusBar.update(statusesForChip(list, acceptedNames), lastConfigStatus);
  serversTreeProvider?.refresh();
  overviewProvider?.update(list, lastConfigStatus, latencyHistory.snapshot());
  if (serversView) {
    serversView.message = emptyViewMessage(lastConfigStatus);
  }
}

function transportOf(name: string): TransportKind {
  const cfg = serverConfigs[name];
  if (!cfg) return 'unknown';
  if (cfg.type === 'stdio' || cfg.type === 'http' || cfg.type === 'sse') return cfg.type;
  return 'unknown';
}

function failureClassFor(name: string, st: ServerStatus): ReturnType<typeof classifyFailure> {
  const cfg = serverConfigs[name];
  const awsProfile = cfg?.type === 'stdio' && cfg.env ? awsProfileFromEnv(cfg.env) : undefined;
  return classifyFailure({
    serverName: name,
    lastError: st.lastError,
    lastProbeError: st.lastProbeError,
    failureContext: st.failureContext,
    config: cfg,
    awsProfileId: awsProfile,
  });
}

function diagnosisFor(name: string, st: ServerStatus) {
  const cfg = serverConfigs[name];
  const awsProfile = cfg?.type === 'stdio' && cfg.env ? awsProfileFromEnv(cfg.env) : undefined;
  return diagnoseFailure({
    serverName: name,
    lastError: st.lastError,
    lastProbeError: st.lastProbeError,
    failureContext: st.failureContext,
    config: cfg,
    awsProfileId: awsProfile,
  });
}

function maybeTrackStateTransition(
  name: string,
  prev: ServerStatus | undefined,
  next: ServerStatus,
): void {
  if (!prev || prev.state === next.state) return;
  const props: {
    transport: TransportKind;
    stateFrom: ServerState;
    stateTo: ServerState;
    failureClass?: ReturnType<typeof classifyFailure>;
    causeId?: ReturnType<typeof diagnosisFor>['causeId'];
  } = {
    transport: transportOf(name),
    stateFrom: prev.state,
    stateTo: next.state,
  };
  if (next.state === 'failed' || next.state === 'degraded') {
    const d = diagnosisFor(name, next);
    props.failureClass = failureClassFor(name, next);
    props.causeId = d.causeId;
  }
  telemetry.track('state_transition', props, { serverKey: name });
  if ((prev.state === 'failed' || prev.state === 'degraded') && next.state === 'healthy') {
    notifyValueMoment();
  }
}

function maybePostBridge(name: string, prev: ServerStatus | undefined, next: ServerStatus): void {
  const cfg = vscode.workspace.getConfiguration('mcpWatchdog');
  if (!cfg.get<boolean>('cloudBridge.enabled', false)) return;
  const url = cfg.get<string>('cloudBridge.url', '').trim();
  if (!url) return;
  if (!prev || prev.state === next.state) {
    // Still post Accept updates when accepted flips with same state — handled separately.
    return;
  }
  const version =
    (extensionContext.extension.packageJSON as { version?: string }).version ?? '0.0.0';
  const payload = buildBridgePayload({
    workspaceIdHash: workspaceIdHash(workspacePath()),
    extensionVersion: version,
    serverName: name,
    config: serverConfigs[name],
    stateFrom: prev.state,
    stateTo: next.state,
    accepted: acceptedNames.has(name),
    toolCount: next.toolCount,
    toolDrift: next.toolDrift,
  });
  void postBridgeIncident(url, payload).then((r) => {
    if (!r.ok && !bridgeFailLogged) {
      bridgeFailLogged = true;
      logger.info(`[Watchdog] Cloud bridge post failed (fail-soft): ${r.error ?? r.status}`);
    }
  });
}

async function postBridgeAccepted(name: string, accepted: boolean): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('mcpWatchdog');
  if (!cfg.get<boolean>('cloudBridge.enabled', false)) return;
  const url = cfg.get<string>('cloudBridge.url', '').trim();
  if (!url) return;
  const st = statuses.get(name);
  if (!st) return;
  const version =
    (extensionContext.extension.packageJSON as { version?: string }).version ?? '0.0.0';
  const payload = buildBridgePayload({
    workspaceIdHash: workspaceIdHash(workspacePath()),
    extensionVersion: version,
    serverName: name,
    config: serverConfigs[name],
    stateFrom: st.state,
    stateTo: st.state,
    accepted,
  });
  await postBridgeIncident(url, payload);
}

function resetConfigWatcher(): void {
  configWatcher?.dispose();
  configWatcher = watchMcpConfig(() => {
    logger.info('[Watchdog] MCP config changed — reloading servers');
    trustPromptShown = false;
    configDiagnostics?.refresh();
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
  const prev = statuses.get(name);
  incidentBuffer.recordChange(name, prev?.state, s.state, s.lastError);
  if (s.state === 'healthy' && s.lastPingMs !== undefined) {
    latencyHistory.push(name, s.lastPingMs);
  }
  if (s.state === 'healthy' && acceptedNames.has(name)) {
    acceptedNames.delete(name);
    void persistAccepted();
  }
  const withFlap = {
    ...s,
    flapping: alertManager.getFlapping(name),
    accepted: acceptedNames.has(name),
    // Keep last Fix verify until healthy (S-VERIFY-01).
    verifiedOutcome:
      s.state === 'healthy' ? undefined : (s.verifiedOutcome ?? prev?.verifiedOutcome),
  };
  statuses.set(name, withFlap);
  alertManager.onStatusChange(withFlap);
  statuses.set(name, {
    ...withFlap,
    flapping: alertManager.getFlapping(name),
    accepted: acceptedNames.has(name),
  });

  maybePostBridge(name, prev, withFlap);
  maybeTrackStateTransition(name, prev, withFlap);
  if (s.toolDrift) {
    const note =
      s.toolDriftNote ??
      `tools changed${s.toolCount !== undefined ? ` (${s.toolCount} tools)` : ''}`;
    void vscode.window.showInformationMessage(`MCP Watchdog: ${name} — ${note}`);
  }
  if (
    withFlap.state === 'healthy' &&
    prev &&
    (prev.state === 'failed' || prev.state === 'degraded')
  ) {
    void maybeAskForReview();
  }
  refreshAllUi();
}

async function maybeAskForReview(): Promise<void> {
  const threshold = vscode.workspace
    .getConfiguration('mcpWatchdog')
    .get<number>('reviewAfterRecoveries', 3);
  if (threshold <= 0) return;
  if (extensionContext.globalState.get<boolean>(ASKED_REVIEW_KEY)) return;

  const count = (extensionContext.globalState.get<number>(RECOVERY_COUNT_KEY) ?? 0) + 1;
  await extensionContext.globalState.update(RECOVERY_COUNT_KEY, count);
  if (count < threshold) return;

  await extensionContext.globalState.update(ASKED_REVIEW_KEY, true);
  const pick = await vscode.window.showInformationMessage(
    'MCP Watchdog helped recover a server. Leave a short review? It helps others find the extension.',
    'Open VSX',
    'Marketplace',
    'Not now',
  );
  if (pick === 'Open VSX') {
    await vscode.env.openExternal(vscode.Uri.parse(OPEN_VSX_REVIEW));
  } else if (pick === 'Marketplace') {
    await vscode.env.openExternal(vscode.Uri.parse(MARKETPLACE_REVIEW));
  }
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

async function notifyEditorMcpResult(
  result: Awaited<ReturnType<typeof tryRestartEditorMcp>>,
): Promise<void> {
  if (result.ok) {
    logger.info(
      `[Watchdog] Editor MCP restart via ${result.method}${result.detail ? ` (${result.detail})` : ''}`,
    );
    if (!editorMcpHintShown) {
      editorMcpHintShown = true;
      void vscode.window.showInformationMessage(
        'MCP Watchdog: attempted editor MCP restart (host workbench.mcp commands).',
      );
    }
    return;
  }
  logger.info(
    `[Watchdog] Editor MCP restart not completed (${result.method})${result.detail ? `: ${result.detail}` : ''}`,
  );
  if (result.method === 'unavailable' && !editorMcpHintShown) {
    editorMcpHintShown = true;
    void vscode.window.showInformationMessage(
      'Editor MCP commands not available on this host — use Reload Window if the editor client is stuck.',
    );
  } else if (result.method === 'listServer') {
    void vscode.window.showInformationMessage(
      result.detail ?? 'Opened MCP: List Servers — choose Restart on the stuck server.',
    );
  }
}

/** Retry Watchdog’s own probe. Does not restart the editor MCP client. */
async function retryProbe(serverName?: string): Promise<void> {
  if (serverName) {
    await monitors.get(serverName)?.forceReconnect();
    return;
  }
  for (const monitor of monitors.values()) {
    await monitor.forceReconnect();
  }
}

async function emitAlert(decision: AlertDecision): Promise<void> {
  lastAlertForTest = decision;
  const show =
    decision.kind === 'error'
      ? vscode.window.showErrorMessage
      : decision.kind === 'warning' || decision.kind === 'flap'
        ? vscode.window.showWarningMessage
        : vscode.window.showInformationMessage;

  let actions = decision.actions;
  if (decision.actions.includes('Retry probe') || decision.actions.includes('Reload Window')) {
    try {
      const cmds = await vscode.commands.getCommands(true);
      actions = failureAlertActionsWithEditorMcp(editorMcpCommandsAvailable(cmds));
    } catch {
      actions = decision.actions;
    }
  }

  const picked = await show(decision.message, ...actions);
  if (!picked) return;

  if (picked === 'Retry probe') {
    trackTriage({ action: 'retry', surface: 'toast' });
    await retryProbe(decision.server);
  } else if (picked === RESTART_EDITOR_MCP_ACTION) {
    trackTriage({ action: 'restart_editor_mcp', surface: 'toast' });
    const result = await tryRestartEditorMcp(vscodeEditorMcpHost, decision.server);
    await notifyEditorMcpResult(result);
  } else if (picked === 'Show Log') {
    logger.show();
    const recent = monitors.get(decision.server)?.getRecentLog() ?? [];
    if (recent.length > 0) {
      logger.info(`--- recent ${decision.server} history ---`);
      for (const line of recent) logger.info(line);
    }
  } else if (picked === 'Reload Window') {
    await vscode.commands.executeCommand('workbench.action.reloadWindow');
  } else if (picked === 'Quit Cursor') {
    try {
      await vscode.commands.executeCommand('workbench.action.quit');
    } catch (err) {
      telemetry.trackError('quit_cursor', err);
      void vscode.window.showInformationMessage(
        'Quit Cursor fully (File → Quit / Exit), then reopen — Reload Window alone is sometimes not enough for stuck MCP.',
      );
    }
  } else if (picked === 'Mute 1h') {
    trackTriage({ action: 'mute', surface: 'toast' });
    alertManager.mute(decision.server, 60 * 60 * 1000);
  } else if (picked === 'Accept') {
    await acceptFailure(decision.server, 'toast');
  } else if (picked === 'Fix…') {
    await fixFailure(decision.server, 'toast');
  } else if (picked === 'Remove') {
    await removeServer(decision.server, 'toast');
  }
}

async function acceptFailure(
  serverName: string,
  surface: TriageSurface = 'command',
): Promise<void> {
  if (!serverName) return;
  const st = statuses.get(serverName);
  if (st?.lastError === 'Awaiting approval') {
    void vscode.window.showInformationMessage(
      'Use Review & Allow for untrusted servers — Accept is for probe failures only.',
    );
    return;
  }
  acceptedNames.add(serverName);
  await persistAccepted();
  const cur = statuses.get(serverName);
  if (cur) statuses.set(serverName, { ...cur, accepted: true });
  const fc = cur ? failureClassFor(serverName, cur) : undefined;
  trackTriage({
    action: 'accept',
    surface,
    ...(fc ? { failureClass: fc } : {}),
  });
  notifyValueMoment();
  await postBridgeAccepted(serverName, true);
  refreshAllUi();
  void vscode.window.showInformationMessage(
    `Accepted failure for ${serverName} — removed from status-bar chip (still Failed in Overview).`,
  );
}

async function clearAcceptance(serverName: string): Promise<void> {
  if (!serverName) return;
  acceptedNames.delete(serverName);
  await persistAccepted();
  const cur = statuses.get(serverName);
  if (cur) statuses.set(serverName, { ...cur, accepted: false });
  await postBridgeAccepted(serverName, false);
  refreshAllUi();
}

function setVerifiedOutcome(serverName: string, outcome: VerifiedOutcome): void {
  const cur = statuses.get(serverName);
  if (!cur) return;
  statuses.set(serverName, { ...cur, verifiedOutcome: outcome });
  refreshAllUi();
}

async function fixFailure(serverName: string, surface: TriageSurface = 'command'): Promise<void> {
  const st = statuses.get(serverName);
  if (!st) {
    void vscode.window.showInformationMessage(`No status for ${serverName}.`);
    return;
  }
  await runFixFailure({
    serverName,
    status: st,
    config: serverConfigs[serverName],
    origin: serverOrigins[serverName],
    logger,
    secrets: extensionContext.secrets,
    surface,
    editorHost: vscodeEditorMcpHost,
    retryProbe,
    openConfigPath: async (filePath) => {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
      await vscode.window.showTextDocument(doc);
    },
    onWatchdogOnlyCred: (name) => {
      watchdogOnlyCred.add(name);
      refreshAllUi();
    },
    getStatus: (name) => statuses.get(name),
    onVerified: setVerifiedOutcome,
    hostCaps,
    workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    doctorMetrics,
  });
}

async function removeServer(serverName: string, surface: TriageSurface = 'command'): Promise<void> {
  await runRemoveServer({
    serverName,
    origin: serverOrigins[serverName],
    origins: serverOrigins,
    logger,
    secrets: extensionContext.secrets,
    surface,
    clearAcceptance,
    disableServer: async (name) => {
      trackTriage({ action: 'remove', surface });
      notifyValueMoment();
      const cfg = vscode.workspace.getConfiguration('mcpWatchdog');
      const per = {
        ...(cfg.get<Record<string, Record<string, unknown>>>('perServer') ?? {}),
      };
      per[name] = { ...(per[name] ?? {}), enabled: false };
      await cfg.update('perServer', per, vscode.ConfigurationTarget.Workspace);
      void vscode.window.showInformationMessage(`Disabled Watchdog monitoring for ${name}.`);
    },
  });
}

async function loadCredentialOverlay(
  name: string,
  config: McpServerConfig,
): Promise<McpServerConfig> {
  const recipe = matchRecipe({ name, config });
  const slot = recipe?.credSlot;
  if (!slot || slot.kind === 'awsProfile') return config;
  try {
    const value = await extensionContext.secrets.get(secretStorageKey(name, slot.name));
    if (!value) return config;
    if (slot.kind === 'env') {
      return mergeCredentialOverlay(config, { env: { [slot.name]: value } });
    }
    return mergeCredentialOverlay(config, { headers: { [slot.name]: value } });
  } catch {
    return config;
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
  } else {
    telemetry.track('trust_decision', { outcome: 'deferred', allowedCount: 0 });
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
    telemetry.track('trust_decision', { outcome: 'revoked', allowedCount: 0 });
    void vscode.window.showInformationMessage('MCP Watchdog: trust revoked for this workspace.');
    trustPromptShown = false;
    await reloadServers();
    return;
  }

  const allowed = selected.map((item) => item.serverName);
  await trustStore.approve(fingerprint, allowed);
  logger.info(`[Watchdog] Approved monitoring ${allowed.length} server(s)`);
  telemetry.track('trust_decision', { outcome: 'allowed', allowedCount: allowed.length });
  notifyValueMoment();
  trustPromptShown = false;
  await reloadServers();
}

export interface McpWatchdogApi {
  getStatuses(): ServerStatus[];
  /** Host-test hook: last alert decision emitted (before user picks an action). */
  getLastAlert(): AlertDecision | undefined;
  revokeTrustForTests(): Promise<void>;
  /** Host-test hook: Accept without UI (same as acceptFailure command). */
  acceptFailureForTests(serverName: string): Promise<void>;
  /**
   * Host-test hook: Remove via runRemoveServer.
   * Set MCP_WATCHDOG_HOST_AUTOCONFIRM=1 to skip the modal.
   */
  removeServerForTests(serverName: string): Promise<void>;
}

export async function activate(context: vscode.ExtensionContext): Promise<McpWatchdogApi> {
  extensionContext = context;
  trustStore = new TrustStore(context.globalState, workspacePath());

  logger = new Logger();
  telemetry.init(context);
  initGithubStar(context);
  context.subscriptions.push(
    { dispose: () => telemetry.dispose() },
    { dispose: () => disposeGithubStar() },
    registerStarCommand(context),
  );
  configDiagnostics = new ConfigDiagnostics();
  context.subscriptions.push(configDiagnostics);
  loadAcceptedFromState();
  alertManager = new AlertManager(
    () =>
      vscode.workspace
        .getConfiguration('mcpWatchdog')
        .get<'all' | 'failures' | 'none'>('notify', 'failures'),
    (decision) => void emitAlert(decision),
    () => Date.now(),
    () =>
      vscode.workspace.getConfiguration('mcpWatchdog').get<number>('degradedAlertDelayMs', 60_000),
    (server) => acceptedNames.has(server),
  );
  statusBar = new McpStatusBar('mcpWatchdog.showStatus');

  overviewProvider = new OverviewViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('mcpWatchdog.overview', overviewProvider),
  );

  const serversTree = new ServersTreeProvider(() => annotateStatuses([...statuses.values()]));
  serversTreeProvider = serversTree;
  serversView = vscode.window.createTreeView('mcpWatchdog.servers', {
    treeDataProvider: serversTree,
  });
  serversView.message = emptyViewMessage({ kind: 'no_workspace' });

  context.subscriptions.push(logger, statusBar, serversView);
  configDiagnostics.refresh();

  context.subscriptions.push(
    vscode.commands.registerCommand('mcpWatchdog.showStatus', () => {
      trackUi('showStatus');
      return showStatusPanel();
    }),
    vscode.commands.registerCommand('mcpWatchdog.reconnectAll', () => {
      trackUi('reconnectAll');
      return reconnectAll();
    }),
    vscode.commands.registerCommand('mcpWatchdog.reconnectServer', () => {
      trackUi('reconnectServer');
      return reconnectServer();
    }),
    vscode.commands.registerCommand('mcpWatchdog.reconnectOne', async (arg: unknown) => {
      trackUi('reconnectServer');
      const name =
        typeof arg === 'string'
          ? arg
          : arg && typeof arg === 'object' && 'serverName' in arg
            ? String((arg as { serverName: string }).serverName)
            : undefined;
      if (name) await retryProbe(name);
    }),
    vscode.commands.registerCommand('mcpWatchdog.focusServersView', () => {
      trackUi('focusServersView');
      return focusServersView();
    }),
    vscode.commands.registerCommand('mcpWatchdog.openMcpConfig', () => {
      trackUi('openMcpConfig');
      return openMcpConfig();
    }),
    vscode.commands.registerCommand('mcpWatchdog.showOutput', () => {
      trackUi('showOutput');
      logger.show();
    }),
    vscode.commands.registerCommand('mcpWatchdog.refresh', () => {
      trackUi('refresh');
      return reloadServers();
    }),
    vscode.commands.registerCommand('mcpWatchdog.reviewTrust', () => {
      trackUi('reviewTrust');
      return reviewTrustQuickPick();
    }),
    vscode.commands.registerCommand('mcpWatchdog.exportIncidentMarkdown', () => {
      trackUi('exportIncident');
      return exportIncidentMarkdown();
    }),
    vscode.commands.registerCommand('mcpWatchdog.acceptFailure', async (arg: unknown) => {
      trackUi('acceptFailure');
      const name = resolveServerArg(arg);
      const surface: TriageSurface = arg ? 'tree' : 'command';
      if (name) await acceptFailure(name, surface);
      else {
        const failed = [...statuses.values()].filter(
          (s) => s.state === 'failed' || s.state === 'degraded',
        );
        const pick = await vscode.window.showQuickPick(
          failed.map((s) => ({ label: s.name, serverName: s.name })),
          { placeHolder: 'Accept failure for…' },
        );
        if (pick) await acceptFailure(pick.serverName, 'command');
      }
    }),
    vscode.commands.registerCommand('mcpWatchdog.clearAcceptance', async (arg: unknown) => {
      trackUi('clearAcceptance');
      const name = resolveServerArg(arg);
      if (name) await clearAcceptance(name);
    }),
    vscode.commands.registerCommand('mcpWatchdog.fixFailure', async (arg: unknown) => {
      trackUi('fixFailure');
      const name = resolveServerArg(arg);
      const surface: TriageSurface = arg ? 'tree' : 'command';
      if (name) await fixFailure(name, surface);
      else {
        const failed = [...statuses.values()].filter(
          (s) => s.state === 'failed' || s.state === 'degraded',
        );
        const pick = await vscode.window.showQuickPick(
          failed.map((s) => ({ label: s.name, serverName: s.name })),
          { placeHolder: 'Fix failure for…' },
        );
        if (pick) await fixFailure(pick.serverName, 'command');
      }
    }),
    vscode.commands.registerCommand('mcpWatchdog.removeServer', async (arg: unknown) => {
      trackUi('removeServer');
      const name = resolveServerArg(arg);
      const surface: TriageSurface = arg ? 'tree' : 'command';
      if (name) await removeServer(name, surface);
      else {
        const pick = await vscode.window.showQuickPick(
          [...statuses.keys()].map((n) => ({ label: n, serverName: n })),
          { placeHolder: 'Remove server…' },
        );
        if (pick) await removeServer(pick.serverName, 'command');
      }
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

  hostCaps = await resolveHostCapabilities(
    {
      appName: vscode.env.appName,
      appRoot: vscode.env.appRoot,
      appHost: vscode.env.appHost,
      uiKind: String(vscode.env.uiKind),
    },
    vscodeEditorMcpHost,
    vscode.version,
  );
  logger.info(
    `[Watchdog] HostCapabilities hostId=${hostCaps.hostId} canRestartServer=${hostCaps.canRestartServer} canObserveConnectionState=${hostCaps.canObserveConnectionState}`,
  );

  const debouncedSettingsReload = debounce(() => {
    logger.info('[Watchdog] Settings changed — reloading servers');
    void reloadServers();
  }, 500);
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('mcpWatchdog')) {
        if (e.affectsConfiguration('mcpWatchdog.diagnostics')) {
          configDiagnostics?.refresh();
        }
        debouncedSettingsReload();
      }
    }),
  );

  try {
    await reloadServers();
  } catch (err) {
    telemetry.trackError('reload_servers', err);
    throw err;
  }

  const version = (context.extension.packageJSON as { version?: string }).version ?? '0.0.0';
  const editor = (vscode.env.appName || 'unknown').slice(0, 64);
  const snap = buildActivationSnapshot();
  telemetry.track('activation', {
    extVersion: version,
    editor,
    vscodeVersion: vscode.version,
    serverCount: snap.serverCount,
    monitoringCount: snap.monitoringCount,
    probeMode: snap.probeMode,
    cloudBridgeEnabled: snap.cloudBridgeEnabled,
    authProbeEnabledCount: snap.authProbeEnabledCount,
    $set: { extVersion: version, editor },
    $set_once: { firstEditor: editor },
  });

  const revealKey = 'mcpWatchdog.didRevealServersView';
  if (!context.globalState.get<boolean>(revealKey)) {
    void context.globalState.update(revealKey, true);
    setTimeout(() => void focusServersView(), 750);
  }

  return {
    getStatuses: () => annotateStatuses([...statuses.values()]),
    getLastAlert: () => lastAlertForTest,
    revokeTrustForTests: async () => {
      await trustStore.revoke();
      trustPromptShown = false;
      await reloadServers();
    },
    acceptFailureForTests: async (serverName: string) => {
      await acceptFailure(serverName);
    },
    removeServerForTests: async (serverName: string) => {
      await removeServer(serverName);
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
  lastAlertForTest = undefined;
  monitors.clear();
  statuses.clear();

  trustStore = new TrustStore(extensionContext.globalState, workspacePath());

  const loaded = loadMcpConfig();
  const { status, config } = loaded;
  lastConfigStatus = status;
  serverOrigins = loaded.origins ?? {};
  serverConfigs = config?.servers ?? {};

  // Drop Accept entries for servers that disappeared from merged config.
  if (config) {
    const names = new Set(Object.keys(config.servers));
    let changed = false;
    for (const n of [...acceptedNames]) {
      if (!names.has(n)) {
        acceptedNames.delete(n);
        changed = true;
      }
    }
    if (changed) void persistAccepted();
  }

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
    checkEmptyTools: cfg.get<boolean>('checkEmptyTools', false),
    detectToolDrift: cfg.get<boolean>('detectToolDrift', false),
    passiveHttpProbe: cfg.get<boolean>('passiveHttpProbe', false),
  };
}

function buildActivationSnapshot(): {
  serverCount: number;
  monitoringCount: number;
  probeMode: ProbeModeSnapshot;
  cloudBridgeEnabled: boolean;
  authProbeEnabledCount: number;
} {
  const cfg = vscode.workspace.getConfiguration('mcpWatchdog');
  const globals = getOptions();
  const per = getPerServerOverrides();
  const names = Object.keys(serverConfigs);
  const modes = new Set<string>();
  let authProbeEnabledCount = 0;
  for (const name of names) {
    const resolved = resolveServerOptions(globals, per, name);
    if (!resolved.enabled) continue;
    modes.add(resolved.options.probeMode);
    if (resolved.options.authProbe) authProbeEnabledCount += 1;
  }
  let probeMode: ProbeModeSnapshot = 'none';
  if (modes.size === 1) probeMode = [...modes][0] as 'interval' | 'persistent';
  else if (modes.size > 1) probeMode = 'mixed';
  return {
    serverCount: names.length,
    monitoringCount: monitors.size,
    probeMode,
    cloudBridgeEnabled: cfg.get<boolean>('cloudBridge.enabled', false),
    authProbeEnabledCount,
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
      accepted: acceptedNames.has(name),
    });
    return;
  }
  void loadCredentialOverlay(name, serverConfig).then((cfg) => {
    serverConfigs[name] = cfg;
    startMonitor(name, cfg, options);
  });
}

async function exportIncidentMarkdown(): Promise<void> {
  const md = incidentBuffer.exportToMarkdown();
  const defaultUri = vscode.Uri.file(
    path.join(os.homedir(), `mcp-watchdog-incidents-${new Date().toISOString().slice(0, 10)}.md`),
  );
  const uri = await vscode.window.showSaveDialog({
    defaultUri,
    filters: { Markdown: ['md'] },
    saveLabel: 'Export incidents',
  });
  if (!uri) return;
  await vscode.workspace.fs.writeFile(uri, Buffer.from(md, 'utf8'));
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc);
  void vscode.window.showInformationMessage(
    `MCP Watchdog: exported ${incidentBuffer.size} incident transition(s).`,
  );
}

async function openMcpConfig(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    void vscode.window.showInformationMessage(
      'Open a folder first, then add .vscode/mcp.json or .cursor/mcp.json.',
    );
    return;
  }

  let folder = folders[0];
  if (folders.length > 1) {
    const picked = await vscode.window.showQuickPick(
      folders.map((f) => ({
        label: f.name,
        description: f.uri.fsPath,
        folder: f,
      })),
      { placeHolder: 'Select workspace folder for MCP config' },
    );
    if (!picked) return;
    folder = picked.folder;
  }

  const root = folder.uri;
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
  void vscode.window.showInformationMessage('MCP Watchdog: retrying probes…');
  await retryProbe();
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
    placeHolder: 'Select a server to retry',
  });
  if (picked) {
    await retryProbe(picked);
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
    placeHolder: 'MCP servers — select to retry the probe',
    canPickMany: false,
  });
  if (!item) return;
  void vscode.window.showInformationMessage(`Retrying probe for ${item.serverName}…`);
  await retryProbe(item.serverName);
}

export async function deactivate(): Promise<void> {
  for (const monitor of monitors.values()) {
    await monitor.stop();
  }
}
