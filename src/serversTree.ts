import * as vscode from 'vscode';
import { ServerState, ServerStatus } from './monitor';

class ServerTreeItem extends vscode.TreeItem {
  constructor(readonly serverName: string, status: ServerStatus) {
    super(status.name, vscode.TreeItemCollapsibleState.None);

    const ping = status.lastPingMs !== undefined ? `${status.lastPingMs} ms` : '—';
    this.description = `${status.state} · ${ping}`;

    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.appendMarkdown(`**${status.name}**\n\n`);
    md.appendMarkdown(`State: \`${status.state}\`\n\n`);
    md.appendMarkdown(`Last ping: ${ping}`);
    if (status.lastError) {
      md.appendMarkdown(`\n\n${status.lastError}`);
    }
    md.appendMarkdown(`\n\n_Click to reconnect_`);
    this.tooltip = md;

    const iconId: Record<ServerState, string> = {
      healthy: 'check',
      connecting: 'sync~spin',
      degraded: 'warning',
      failed: 'error',
      disconnected: 'circle-slash',
    };
    this.iconPath = new vscode.ThemeIcon(iconId[status.state]);

    this.command = {
      command: 'mcpWatchdog.reconnectOne',
      title: 'Reconnect',
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
    return this.getStatuses().map((s) => new ServerTreeItem(s.name, s));
  }

  getParent(): undefined {
    return undefined;
  }
}
