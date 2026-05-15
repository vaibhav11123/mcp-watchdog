import * as vscode from 'vscode';
import { ServerStatus } from './monitor';

export class McpStatusBar implements vscode.Disposable {
  private item: vscode.StatusBarItem;

  constructor(commandId: string) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
    this.item.command = commandId;
    this.item.show();
  }

  update(statuses: ServerStatus[]): void {
    const total = statuses.length;
    if (total === 0) {
      this.item.text = '$(circle-slash) MCP';
      this.item.tooltip = 'No MCP servers configured';
      this.item.backgroundColor = undefined;
      return;
    }

    const healthy = statuses.filter((s) => s.state === 'healthy').length;
    const failed = statuses.filter((s) => s.state === 'failed').length;
    const connecting = statuses.filter((s) => s.state === 'connecting').length;
    const degraded = statuses.some((s) => s.state === 'degraded');

    if (healthy === total) {
      this.item.text = `$(check) MCP: ${healthy}/${total}`;
      this.item.tooltip = this.buildTooltip(statuses);
      this.item.backgroundColor = undefined;
    } else if (failed > 0) {
      this.item.text = `$(warning) MCP: ${healthy}/${total}`;
      this.item.tooltip = this.buildTooltip(statuses);
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else if (connecting > 0) {
      this.item.text = `$(sync~spin) MCP: ${healthy}/${total}`;
      this.item.tooltip = this.buildTooltip(statuses);
      this.item.backgroundColor = undefined;
    } else if (degraded) {
      this.item.text = `$(warning) MCP: ${healthy}/${total}`;
      this.item.tooltip = this.buildTooltip(statuses);
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      this.item.text = `$(circle-slash) MCP: ${healthy}/${total}`;
      this.item.tooltip = this.buildTooltip(statuses);
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }
  }

  private buildTooltip(statuses: ServerStatus[]): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.appendMarkdown('**MCP Watchdog**\n\n');
    for (const s of statuses) {
      const icon = {
        healthy: '$(check)',
        connecting: '$(sync~spin)',
        degraded: '$(warning)',
        failed: '$(error)',
        disconnected: '$(circle-slash)',
      }[s.state];
      const ping = s.lastPingMs !== undefined ? ` · ${s.lastPingMs}ms` : '';
      md.appendMarkdown(`${icon} **${s.name}** — ${s.state}${ping}\n\n`);
    }
    md.appendMarkdown('\n_Click to manage_');
    return md;
  }

  dispose(): void {
    this.item.dispose();
  }
}
