import * as vscode from 'vscode';
import type { ServerStatus } from './monitor';
import type { McpConfigStatus } from './config';
import { statusesSnapshot, renderOverviewBody, wrapOverviewDocument } from './ui/overviewHtml';

export class OverviewViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  /** Last full document HTML — re-applied on resolve/visibility so untrusted never sticks as no_workspace. */
  private lastHtml?: string;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;
    const webview = webviewView.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webview.html =
      this.lastHtml ??
      wrapOverviewDocument(
        renderOverviewBody(statusesSnapshot([], { kind: 'no_workspace' }, {})),
        String(Date.now()),
      );

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible && this.lastHtml) {
        webviewView.webview.html = this.lastHtml;
      }
    });

    webview.onDidReceiveMessage((msg: { type?: string }) => {
      switch (msg.type) {
        case 'reconnectAll':
          void vscode.commands.executeCommand('mcpWatchdog.reconnectAll');
          break;
        case 'openConfig':
          void vscode.commands.executeCommand('mcpWatchdog.openMcpConfig');
          break;
        case 'showOutput':
          void vscode.commands.executeCommand('mcpWatchdog.showOutput');
          break;
        case 'openFolder':
          void vscode.commands.executeCommand('workbench.action.openFolder');
          break;
        case 'reviewTrust':
          void vscode.commands.executeCommand('mcpWatchdog.reviewTrust');
          break;
        case 'reconnect':
          if (typeof (msg as { server?: string }).server === 'string') {
            void vscode.commands.executeCommand(
              'mcpWatchdog.reconnectOne',
              (msg as { server: string }).server,
            );
          }
          break;
        case 'starOnGitHub':
          void vscode.commands.executeCommand('mcpWatchdog.starOnGitHub');
          break;
      }
    });
  }

  update(
    statuses: ServerStatus[],
    configStatus: McpConfigStatus,
    latencyByServer: Record<string, number[]> = {},
  ): void {
    const snapshot = statusesSnapshot(statuses, configStatus, latencyByServer);
    const html = wrapOverviewDocument(renderOverviewBody(snapshot), String(Date.now()));
    this.lastHtml = html;
    if (this.view) {
      this.view.webview.html = html;
    }
    if (!this.view) return;
    if (statuses.some((s) => s.state === 'failed' || s.state === 'degraded')) {
      this.view.description = 'Needs attention';
    } else if (statuses.length > 0 && statuses.every((s) => s.state === 'healthy')) {
      this.view.description = 'All healthy';
    } else {
      this.view.description = undefined;
    }
  }
}
