import * as vscode from 'vscode';
import { ServerStatus } from './monitor';
import {
  formatTreeDescription,
  stateThemeIcon,
  STATE_PRESENTATION,
} from './ui/statePresentation';

class ServerTreeItem extends vscode.TreeItem {
  constructor(readonly serverName: string, status: ServerStatus) {
    super(status.name, vscode.TreeItemCollapsibleState.None);

    this.description = formatTreeDescription(status.state, status.lastPingMs);
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
    if (status.retryCount > 0) {
      md.appendMarkdown(`Retries: ${status.retryCount}\n\n`);
    }
    if (status.lastError) {
      md.appendMarkdown(`Error: ${status.lastError}\n\n`);
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
