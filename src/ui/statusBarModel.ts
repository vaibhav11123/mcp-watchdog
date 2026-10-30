import type { McpConfigStatus } from '../config-core';
import type { ServerStatus } from '../monitor';
import { STATE_LABELS } from './stateLabels';

export type StatusBarSeverity = 'none' | 'warning' | 'error';

export interface StatusBarModel {
  text: string;
  /** Plain first-line disclaimer + per-server lines (markdown-friendly). */
  tooltipLines: string[];
  severity: StatusBarSeverity;
}

const REACHABILITY =
  'Watchdog reachability (editor MCP may differ). Reconnect also best-effort restarts editor MCP when workbench.mcp.* exists.';

export function buildStatusBarModel(
  statuses: ServerStatus[],
  configStatus?: McpConfigStatus,
): StatusBarModel {
  if (configStatus?.kind === 'untrusted') {
    return {
      text: '$(shield) Watchdog: untrusted',
      tooltipLines: [
        `${configStatus.serverCount} server(s) awaiting approval — click to review`,
        REACHABILITY,
      ],
      severity: 'warning',
    };
  }

  const total = statuses.length;
  if (total === 0) {
    return {
      text: '$(circle-slash) Watchdog',
      tooltipLines: ['No MCP servers monitored — open MCP Watchdog sidebar', REACHABILITY],
      severity: 'none',
    };
  }

  const healthy = statuses.filter((s) => s.state === 'healthy').length;
  const failed = statuses.filter((s) => s.state === 'failed').length;
  const connecting = statuses.filter((s) => s.state === 'connecting').length;
  const degraded = statuses.some((s) => s.state === 'degraded');

  let text: string;
  let severity: StatusBarSeverity;
  if (healthy === total) {
    text = `$(check) Watchdog: ${healthy}/${total}`;
    severity = 'none';
  } else if (failed > 0) {
    text = `$(error) Watchdog: ${healthy}/${total}`;
    severity = 'error';
  } else if (connecting > 0 || degraded) {
    text = `$(sync~spin) Watchdog: ${healthy}/${total}`;
    severity = 'warning';
  } else {
    text = `$(circle-slash) Watchdog: ${healthy}/${total}`;
    severity = 'none';
  }

  const tooltipLines = [REACHABILITY, ''];
  for (const s of statuses) {
    const p = STATE_LABELS[s.state];
    const ping = s.lastPingMs !== undefined ? ` · ${s.lastPingMs} ms` : '';
    const tools =
      s.toolCount !== undefined ? ` · ${s.toolCount} tool${s.toolCount === 1 ? '' : 's'}` : '';
    tooltipLines.push(`**${s.name}** — ${p.label}${ping}${tools}`);
    if (s.lastError) tooltipLines.push(`Error: ${s.lastError}`);
    if (s.failureContext) {
      for (const line of s.failureContext.split('\n').slice(0, 3)) {
        tooltipLines.push(line);
      }
    }
  }

  return { text, tooltipLines, severity };
}
