/**
 * Merge SecretStorage credentials into a server config (in memory only).
 * Never log values — callers must only log slot names.
 */
import type { McpServerConfig } from './config-core';

export function mergeCredentialOverlay(
  config: McpServerConfig,
  overlay: { env?: Record<string, string>; headers?: Record<string, string> },
): McpServerConfig {
  if (config.type === 'stdio') {
    if (!overlay.env || Object.keys(overlay.env).length === 0) return config;
    return {
      ...config,
      env: { ...(config.env ?? {}), ...overlay.env },
    };
  }
  if (!overlay.headers || Object.keys(overlay.headers).length === 0) return config;
  return {
    ...config,
    headers: { ...(config.headers ?? {}), ...overlay.headers },
  };
}

export function secretStorageKey(serverName: string, slotId: string): string {
  return `mcpWatchdog.cred.${serverName}.${slotId}`;
}
