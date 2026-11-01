import type { McpServerConfig } from './config-core';

export type CredSlot =
  | { kind: 'env'; name: string }
  | { kind: 'header'; name: string }
  | { kind: 'awsProfile'; envKeys: string[] };

export interface VendorRecipe {
  id: 'aws' | 'exa';
  loginUrl?: string;
  dashboardUrl?: string;
  credSlot?: CredSlot;
}

export interface RecipeMatchContext {
  name: string;
  config?: McpServerConfig;
}

function argsHaystack(config?: McpServerConfig): string {
  if (!config || config.type !== 'stdio') return '';
  return [config.command, ...(config.args ?? [])].join(' ');
}

function urlOf(config?: McpServerConfig): string {
  if (!config || (config.type !== 'http' && config.type !== 'sse')) return '';
  return config.url;
}

export function matchRecipe(ctx: RecipeMatchContext): VendorRecipe | undefined {
  const name = ctx.name || '';
  const args = argsHaystack(ctx.config);
  const url = urlOf(ctx.config);

  if (/aws/i.test(name) || /mcp-proxy-for-aws/i.test(args)) {
    return {
      id: 'aws',
      credSlot: { kind: 'awsProfile', envKeys: ['AWS_MCP_PROXY_PROFILES', 'AWS_PROFILE'] },
    };
  }

  if (/exa/i.test(name) || /mcp\.exa\.ai/i.test(url) || /exa-mcp-server/i.test(args)) {
    const isHttp =
      ctx.config?.type === 'http' || ctx.config?.type === 'sse' || /mcp\.exa\.ai/i.test(url);
    return {
      id: 'exa',
      loginUrl: 'https://mcp.exa.ai/mcp?login',
      dashboardUrl: 'https://dashboard.exa.ai',
      credSlot: isHttp
        ? { kind: 'header', name: 'x-api-key' }
        : { kind: 'env', name: 'EXA_API_KEY' },
    };
  }

  return undefined;
}

/** Read profile id from env **keys** only (comma → first). Never log other env. */
export function awsProfileFromEnv(
  env: Record<string, string | undefined> | NodeJS.ProcessEnv,
  keys: string[] = ['AWS_MCP_PROXY_PROFILES', 'AWS_PROFILE'],
): string | undefined {
  for (const k of keys) {
    const v = env[k];
    if (typeof v === 'string' && v.trim()) {
      return v.split(',')[0]!.trim();
    }
  }
  return undefined;
}

/** Env keys present on a stdio config (names only). */
export function envNamesOf(config?: McpServerConfig): string[] | undefined {
  if (!config || config.type !== 'stdio' || !config.env) return undefined;
  return Object.keys(config.env);
}

export function headerNamesOf(config?: McpServerConfig): string[] | undefined {
  if (!config || (config.type !== 'http' && config.type !== 'sse') || !config.headers) {
    return undefined;
  }
  return Object.keys(config.headers);
}
