import * as vscode from 'vscode';
import { ServerStatus } from './monitor';
import { formatTreeDescription, stateThemeIcon, STATE_PRESENTATION } from './ui/statePresentation';

class ServerTreeItem extends vscode.TreeItem {
  constructor(
    readonly serverName: string,
    status: ServerStatus,
  ) {
    super(status.name, vscode.TreeItemCollapsibleState.None);

    const mode =
      status.probeMode === 'interval'
        ? 'interval probe'
        : status.probeMode === 'persistent'
          ? 'persistent'
          : undefined;
    const flapping = status.flapping ? ' (flapping)' : '';
    const disabled = status.disabled ? ' (disabled)' : '';
    const modeSuffix = mode ? ` · ${mode}` : '';
    const toolsSuffix =
      status.toolCount === 0
        ? ' · 0 tools'
        : status.toolCount !== undefined
          ? ` · ${status.toolCount} tools`
          : '';
    this.description =
      formatTreeDescription(status.state, status.lastPingMs) +
      modeSuffix +
      toolsSuffix +
      flapping +
      disabled;
    this.contextValue = 'mcpWatchdogServer';

    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.supportHtml = false;
    const p = STATE_PRESENTATION[status.state];
    md.appendMarkdown(`**${status.name}**\n\n`);
    md.appendMarkdown(`Status: **${p.label}**\n\n`);
    md.appendMarkdown(
      `Latency: ${status.lastPingMs !== undefined ? `${status.lastPingMs} ms` : '—'}\n\n`,
    );
    if (status.toolCount !== undefined) {
      md.appendMarkdown(`Tools: **${status.toolCount}**\n\n`);
    }
    if (status.probeMode) {
      md.appendMarkdown(
        `Mode: **${status.probeMode === 'interval' ? 'interval probe' : 'persistent'}**\n\n`,
      );
    }
    if (status.disabled) {
      md.appendMarkdown('Monitoring: **disabled** (per-server setting)\n\n');
    }
    if (status.retryCount > 0) {
      md.appendMarkdown(`Retries: ${status.retryCount}\n\n`);
    }
    if (status.lastError) {
      md.appendMarkdown(`Error: ${status.lastError}\n\n`);
    }
    if (status.failureContext) {
      const snippet = status.failureContext.split('\n').slice(-3).join('\n');
      md.appendMarkdown('```\n' + snippet + '\n```\n\n');
    }
    const args = encodeURIComponent(JSON.stringify([serverName]));
    md.appendMarkdown(`[Reconnect](command:mcpWatchdog.reconnectOne?${args})`);
    this.tooltip = md;

    this.iconPath = stateThemeIcon(status.state);

    this.command = {
      command: 'mcpWatchdog.reconnectOne',
      title: 'Reconnect server',
      arguments: [serverName],
    };
  }
}

export class ServersTreeProvider implements vscode.TreeDataProvider<ServerTreeItem> {
  private readonly _onDidChange = new vscode.EventEmitter<ServerTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor(private readonly getStatuses: () => ServerStatus[]) {}

  refresh(): void {
    this._onDidChange.fire();
  }

  getTreeItem(element: ServerTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): ServerTreeItem[] {
    const statuses = this.getStatuses();
    return statuses.map((s) => new ServerTreeItem(s.name, s));
  }

  getParent(): undefined {
    return undefined;
  }
}
