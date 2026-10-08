import * as vscode from 'vscode';
import type { ServerState } from '../monitor';
import { STATE_LABELS } from './stateLabels';

/** Human-readable labels + ThemeIcon (codicons) — no emoji in UI. */
export const STATE_PRESENTATION = STATE_LABELS;

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

/** Shown when workspace MCP config exists but user has not approved monitoring yet. */
export const UNTRUSTED_PRESENTATION = {
  label: 'Awaiting approval',
  icon: 'shield',
  themeColor: 'editorWarning.foreground',
} as const;
