import type { McpServerConfig } from '../config-core';
import { mergeCredentialOverlay } from '../credentialOverlay';

/**
 * Keys in stdio env that are empty / unexpanded but present in process.env.
 * Overlay is in-memory only — never written to mcp.json (PRD secret policy).
 */
export function fillableEnvKeys(
  config: McpServerConfig,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  if (config.type !== 'stdio' || !config.env) return [];
  const keys: string[] = [];
  for (const [k, v] of Object.entries(config.env)) {
    const empty = !v || !String(v).trim() || /\$\{env:[^}]+\}/.test(String(v));
    if (empty && env[k]) keys.push(k);
  }
  return keys;
}

/** Apply process.env values for fillable keys — values never logged. */
export function applyProcessEnvOverlay(
  config: McpServerConfig,
  env: NodeJS.ProcessEnv = process.env,
): { config: McpServerConfig; filledKeys: string[] } {
  const filledKeys = fillableEnvKeys(config, env);
  if (filledKeys.length === 0) return { config, filledKeys };
  const overlayEnv: Record<string, string> = {};
  for (const k of filledKeys) {
    const val = env[k];
    if (val !== undefined) overlayEnv[k] = val;
  }
  return {
    config: mergeCredentialOverlay(config, { env: overlayEnv }),
    filledKeys,
  };
}
