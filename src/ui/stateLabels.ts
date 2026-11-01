import type { ServerState } from '../monitor';

/** vscode-free labels/icons for unit tests and pure UI models. */
export const STATE_LABELS: Record<
  ServerState,
  { label: string; icon: string; themeColor?: string }
> = {
  healthy: { label: 'Healthy', icon: 'check', themeColor: 'testing.iconPassed' },
  connecting: { label: 'Connecting', icon: 'sync~spin' },
  degraded: { label: 'Retrying', icon: 'warning', themeColor: 'editorWarning.foreground' },
  failed: { label: 'Failed', icon: 'error', themeColor: 'errorForeground' },
  disconnected: { label: 'Offline', icon: 'circle-slash', themeColor: 'descriptionForeground' },
};
