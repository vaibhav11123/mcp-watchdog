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
  'Watchdog reachability (editor MCP may differ). Parallel health probes — not the editor client.';

export function buildStatusBarModel(
  statuses: ServerStatus[],
  configStatus?: McpConfigStatus,
): StatusBarModel {
  if (configStatus?.kind === 'untrusted') {
    return {
      text: '$(shield) MCP: untrusted',
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
      text: '$(circle-slash) MCP',
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
    text = `$(check) MCP: ${healthy}/${total}`;
    severity = 'none';
  } else if (failed > 0) {
    text = `$(error) MCP: ${healthy}/${total}`;
    severity = 'error';
  } else if (connecting > 0 || degraded) {
    text = `$(sync~spin) MCP: ${healthy}/${total}`;
    severity = 'warning';
  } else {
    text = `$(circle-slash) MCP: ${healthy}/${total}`;
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
