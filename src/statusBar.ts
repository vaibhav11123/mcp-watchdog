import * as vscode from 'vscode';
import type { McpConfigStatus } from './config-core';
import { ServerStatus } from './monitor';
import { buildStatusBarModel } from './ui/statusBarModel';

export class McpStatusBar implements vscode.Disposable {
  private item: vscode.StatusBarItem;

  constructor(commandId: string) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
    this.item.command = commandId;
    this.item.show();
  }

  update(statuses: ServerStatus[], configStatus?: McpConfigStatus): void {
    const model = buildStatusBarModel(statuses, configStatus);
    this.item.text = model.text;

    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.appendMarkdown('**MCP Watchdog**\n\n');
    for (const line of model.tooltipLines) {
      if (line === '') md.appendMarkdown('\n');
      else md.appendMarkdown(`${line}\n\n`);
    }
    md.appendMarkdown(
      '\n[Open dashboard](command:mcpWatchdog.overview.focus) · [Reconnect all](command:mcpWatchdog.reconnectAll)',
    );
    this.item.tooltip = md;

    if (model.severity === 'error') {
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (model.severity === 'warning') {
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      this.item.backgroundColor = undefined;
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}
