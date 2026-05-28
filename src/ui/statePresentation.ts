import * as vscode from 'vscode';
import type { ServerState } from '../monitor';

/** Human-readable labels + ThemeIcon (codicons) — no emoji in UI. */
export const STATE_PRESENTATION: Record<
  ServerState,
  { label: string; icon: string; themeColor?: string }
> = {
  healthy: { label: 'Healthy', icon: 'check', themeColor: 'testing.iconPassed' },
  connecting: { label: 'Connecting', icon: 'sync~spin' },
  degraded: { label: 'Reconnecting', icon: 'warning', themeColor: 'editorWarning.foreground' },
  failed: { label: 'Failed', icon: 'error', themeColor: 'errorForeground' },
  disconnected: { label: 'Offline', icon: 'circle-slash', themeColor: 'descriptionForeground' },
};

export function stateThemeIcon(state: ServerState): vscode.ThemeIcon {
  const p = STATE_PRESENTATION[state];
  return p.themeColor
    ? new vscode.ThemeIcon(p.icon, new vscode.ThemeColor(p.themeColor))
    : new vscode.ThemeIcon(p.icon);
}

export function formatPing(lastPingMs?: number): string {
  return lastPingMs !== undefined ? `${lastPingMs} ms` : '—';
}

export function formatTreeDescription(state: ServerState, lastPingMs?: number): string {
  return `${STATE_PRESENTATION[state].label} · ${formatPing(lastPingMs)}`;
}
