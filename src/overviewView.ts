import * as vscode from 'vscode';
import type { ServerStatus, ServerState } from './monitor';
import type { McpConfigStatus } from './config';
import { STATE_PRESENTATION } from './ui/statePresentation';

export class OverviewViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

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

    webview.html = this.renderHtml(statusesSnapshot([], { kind: 'no_workspace' }));

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
        case 'reconnect':
          if (typeof (msg as { server?: string }).server === 'string') {
            void vscode.commands.executeCommand(
              'mcpWatchdog.reconnectOne',
              (msg as { server: string }).server,
            );
          }
          break;
      }
    });
  }

  update(statuses: ServerStatus[], configStatus: McpConfigStatus): void {
    if (!this.view) return;
    this.view.webview.html = this.renderHtml(statusesSnapshot(statuses, configStatus));
    if (statuses.some((s) => s.state === 'failed' || s.state === 'degraded')) {
      this.view.description = 'Needs attention';
    } else if (statuses.length > 0 && statuses.every((s) => s.state === 'healthy')) {
      this.view.description = 'All healthy';
    } else {
      this.view.description = undefined;
    }
  }

  private renderHtml(data: OverviewSnapshot): string {
    const nonce = String(Date.now());
    const body = data.empty
      ? renderEmptyState(data.configStatus)
      : renderDashboard(data);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px 14px 16px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      line-height: 1.45;
    }
    h1 {
      margin: 0 0 4px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
    }
    .summary {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .metric {
      padding: 10px 8px;
      border-radius: 6px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border: 1px solid var(--vscode-widget-border, transparent);
      text-align: center;
    }
    .metric strong {
      display: block;
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 2px;
    }
    .metric span {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--vscode-descriptionForeground);
    }
    .metric.ok strong { color: #22c55e; }
    .metric.warn strong { color: var(--vscode-editorWarning-foreground); }
    .metric.bad strong { color: var(--vscode-errorForeground); }
    ul {
      list-style: none;
      margin: 0 0 14px;
      padding: 0;
    }
    li {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px 0;
      border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-widget-border, #333));
    }
    li:last-child { border-bottom: none; }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-top: 5px;
      flex-shrink: 0;
    }
    .dot.ok { background: #22c55e; }
    .dot.warn { background: var(--vscode-editorWarning-foreground); }
    .dot.bad { background: var(--vscode-errorForeground); }
    .dot.muted { background: var(--vscode-descriptionForeground); }
    .server-name { font-weight: 600; }
    .server-meta {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    .server-error {
      font-size: 11px;
      color: var(--vscode-errorForeground);
      margin-top: 4px;
      word-break: break-word;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    button {
      cursor: pointer;
      border: none;
      border-radius: 4px;
      padding: 6px 10px;
      font-size: 12px;
      font-family: inherit;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    button.link {
      background: transparent;
      color: var(--vscode-textLink-foreground);
      padding: 6px 4px;
      text-decoration: underline;
    }
    .empty {
      padding: 8px 0;
    }
    .empty p { margin: 0 0 10px; color: var(--vscode-descriptionForeground); }
    @media (prefers-reduced-motion: reduce) {
      * { transition: none !important; }
    }
  </style>
</head>
<body>
  ${body}
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('[data-action]').forEach((el) => {
      el.addEventListener('click', () => {
        const action = el.getAttribute('data-action');
        const server = el.getAttribute('data-server');
        if (action === 'reconnect' && server) {
          vscode.postMessage({ type: 'reconnect', server });
        } else if (action) {
          vscode.postMessage({ type: action });
        }
      });
    });
  </script>
</body>
</html>`;
  }
}

interface OverviewSnapshot {
  empty: boolean;
  configStatus: McpConfigStatus;
  healthy: number;
  attention: number;
  failed: number;
  total: number;
  servers: Array<{
    name: string;
    state: ServerState;
    label: string;
    ping: string;
    error?: string;
    dotClass: string;
  }>;
}

function statusesSnapshot(statuses: ServerStatus[], configStatus: McpConfigStatus): OverviewSnapshot {
  const servers = statuses.map((s) => {
    const p = STATE_PRESENTATION[s.state];
    const dotClass =
      s.state === 'healthy'
        ? 'ok'
        : s.state === 'failed'
          ? 'bad'
          : s.state === 'connecting' || s.state === 'degraded'
            ? 'warn'
            : 'muted';
    return {
      name: s.name,
      state: s.state,
      label: p.label,
      ping: s.lastPingMs !== undefined ? `${s.lastPingMs} ms` : '—',
      error: s.lastError,
      dotClass,
    };
  });

  const healthy = statuses.filter((s) => s.state === 'healthy').length;
  const failed = statuses.filter((s) => s.state === 'failed').length;
  const attention = statuses.filter((s) => s.state === 'degraded' || s.state === 'connecting').length;

  return {
    empty: statuses.length === 0,
    configStatus,
    healthy,
    attention,
    failed,
    total: statuses.length,
    servers,
  };
}

function renderEmptyState(configStatus: McpConfigStatus): string {
  let message = 'Open a folder to start monitoring MCP servers.';
  let primary = { action: 'openFolder', label: 'Open folder' };
  if (configStatus.kind === 'no_config') {
    message = 'Add MCP config for this workspace (.cursor/mcp.json or .vscode/mcp.json).';
    primary = { action: 'openConfig', label: 'Create MCP config' };
  } else if (configStatus.kind === 'empty_servers') {
    message = 'Config file found but no valid server entries.';
    primary = { action: 'openConfig', label: 'Edit MCP config' };
  }

  return `
    <h1>MCP Watchdog</h1>
    <div class="empty">
      <p>${escapeHtml(message)}</p>
      <div class="actions">
        <button data-action="${primary.action}">${escapeHtml(primary.label)}</button>
        <button class="secondary" data-action="showOutput">View logs</button>
      </div>
    </div>`;
}

function renderDashboard(data: OverviewSnapshot): string {
  const summary =
    data.failed > 0
      ? `${data.failed} failed · ${data.healthy}/${data.total} healthy`
      : data.attention > 0
        ? `${data.attention} reconnecting · ${data.healthy}/${data.total} healthy`
        : `All ${data.total} servers healthy`;

  const rows = data.servers
    .map(
      (s) => `
    <li>
      <span class="dot ${s.dotClass}" aria-hidden="true"></span>
      <div style="flex:1;min-width:0">
        <div class="server-name">${escapeHtml(s.name)}</div>
        <div class="server-meta">${escapeHtml(s.label)} · ${escapeHtml(s.ping)}</div>
        ${s.error ? `<div class="server-error">${escapeHtml(s.error)}</div>` : ''}
        ${
          s.state === 'failed' || s.state === 'degraded'
            ? `<div class="actions" style="margin-top:6px"><button class="link" data-action="reconnect" data-server="${escapeHtml(s.name)}">Reconnect</button></div>`
            : ''
        }
      </div>
    </li>`,
    )
    .join('');

  return `
    <h1>MCP Watchdog</h1>
    <div class="summary">${escapeHtml(summary)}</div>
    <div class="metrics">
      <div class="metric ok"><strong>${data.healthy}</strong><span>Healthy</span></div>
      <div class="metric warn"><strong>${data.attention}</strong><span>Active</span></div>
      <div class="metric bad"><strong>${data.failed}</strong><span>Failed</span></div>
    </div>
    <ul>${rows}</ul>
    <div class="actions">
      <button data-action="reconnectAll">Reconnect all</button>
      <button class="secondary" data-action="openConfig">MCP config</button>
      <button class="secondary" data-action="showOutput">Logs</button>
    </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
