import * as path from 'path';

export type McpServerConfig =
  | {
      type: 'stdio';
      command: string;
      args?: string[];
      env?: Record<string, string>;
      cwd?: string;
    }
  | {
      type: 'http';
      url: string;
      headers?: Record<string, string>;
    }
  | {
      type: 'sse';
      url: string;
      headers?: Record<string, string>;
    };

/** Project mcp.json paths for every workspace folder root (multi-root safe). */
export function projectMcpJsonPaths(folderRoots: string[]): string[] {
  const out: string[] = [];
  for (const root of folderRoots) {
    out.push(path.join(root, '.vscode', 'mcp.json'), path.join(root, '.cursor', 'mcp.json'));
  }
  return out;
}

export interface McpConfig {
  servers: Record<string, McpServerConfig>;
}

export type McpConfigStatus =
  | { kind: 'no_workspace' }
  | { kind: 'no_config' }
  | { kind: 'empty_servers'; sources: string[] }
  | { kind: 'untrusted'; sources: string[]; serverCount: number }
  | { kind: 'ok'; sources: string[] };

export interface McpConfigResult {
  status: McpConfigStatus;
  config: McpConfig | null;
}

export type ParseConfigResult =
  | { ok: true; servers: Record<string, McpServerConfig> }
  | { ok: false; error: 'syntax' | 'no_block' };

export interface ConfigLayer {
  servers: Record<string, McpServerConfig>;
  label: string;
}

const WORKSPACE_FOLDER = /\$\{workspaceFolder\}/g;
const USER_HOME = /\$\{userHome\}/g;
const ENV_VAR = /\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}/g;

export interface ExpandVarsContext {
  workspaceRoot?: string;
  userHome?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * Expand VS Code-style placeholders used in mcp.json.
 * Supports `${workspaceFolder}`, `${userHome}`, `${env:NAME}`.
 * Missing env vars are left as the literal `${env:NAME}` (never logged as values elsewhere).
 * `${input:…}` is intentionally not expanded.
 */
export function expandWorkspaceVars<V>(
  value: V,
  workspaceRootOrCtx: string | undefined | ExpandVarsContext,
): V {
  const ctx: ExpandVarsContext =
    typeof workspaceRootOrCtx === 'object' && workspaceRootOrCtx !== null
      ? workspaceRootOrCtx
      : { workspaceRoot: workspaceRootOrCtx };

  const expandString = (s: string): string => {
    let out = s;
    if (ctx.workspaceRoot) out = out.replace(WORKSPACE_FOLDER, ctx.workspaceRoot);
    if (ctx.userHome) out = out.replace(USER_HOME, ctx.userHome);
    const env = ctx.env ?? process.env;
    out = out.replace(ENV_VAR, (match, name: string) => {
      const v = env[name];
      return v !== undefined && v !== '' ? v : match;
    });
    return out;
  };

  if (typeof value === 'string') return expandString(value) as V;
  if (Array.isArray(value)) return value.map((item) => expandWorkspaceVars(item, ctx)) as V;
  if (value !== null && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(o)) out[key] = expandWorkspaceVars(o[key], ctx);
    return out as V;
  }
  return value;
}

export function extractServersBlock(parsed: unknown): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as Record<string, unknown>;
  const block = o.servers ?? o.mcpServers;
  if (!block || typeof block !== 'object' || Array.isArray(block)) return null;
  return block as Record<string, unknown>;
}

export function normalizeServerEntry(entry: unknown): McpServerConfig | null {
  if (!entry || typeof entry !== 'object') return null;
  const e = entry as Record<string, unknown>;

  const explicitType = e.type;
  const transport = typeof e.transport === 'string' ? e.transport : undefined;
  const wantsSse = explicitType === 'sse' || transport === 'sse';
  const hasUrl = typeof e.url === 'string' && e.url.length > 0;

  if (explicitType === 'http' || explicitType === 'sse' || hasUrl) {
    const url = hasUrl ? (e.url as string) : '';
    if (!url) return null;
    const headers =
      e.headers && typeof e.headers === 'object' && !Array.isArray(e.headers)
        ? (e.headers as Record<string, string>)
        : undefined;
    if (wantsSse) {
      return { type: 'sse', url, headers };
    }
    return { type: 'http', url, headers };
  }

  const command = typeof e.command === 'string' ? e.command : '';
  if (!command) return null;

  return {
    type: 'stdio',
    command,
    args: Array.isArray(e.args) ? (e.args as string[]) : undefined,
    env:
      e.env && typeof e.env === 'object' && !Array.isArray(e.env)
        ? (e.env as Record<string, string>)
        : undefined,
    cwd: typeof e.cwd === 'string' ? e.cwd : undefined,
  };
}

export function parseConfigFile(
  raw: string,
  workspaceRoot?: string,
  expandCtx?: Omit<ExpandVarsContext, 'workspaceRoot'>,
): ParseConfigResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'syntax' };
  }

  const block = extractServersBlock(parsed);
  if (!block) return { ok: false, error: 'no_block' };

  const ctx: ExpandVarsContext = {
    workspaceRoot,
    userHome: expandCtx?.userHome,
    env: expandCtx?.env,
  };

  const servers: Record<string, McpServerConfig> = {};
  for (const key of Object.keys(block)) {
    const normalized = normalizeServerEntry(block[key]);
    if (normalized) {
      servers[key] = expandWorkspaceVars(normalized, ctx);
    }
  }
  return { ok: true, servers };
}

export function mergeConfigLayers(layers: (ConfigLayer | null)[]): {
  merged: Record<string, McpServerConfig>;
  sources: string[];
} {
  const merged: Record<string, McpServerConfig> = {};
  const sources: string[] = [];
  for (const layer of layers) {
    if (!layer) continue;
    sources.push(layer.label);
    Object.assign(merged, layer.servers);
  }
  return { merged, sources: [...new Set(sources)] };
}

export function emptyViewMessage(status: McpConfigStatus): string {
  switch (status.kind) {
    case 'no_workspace':
      return 'Open a folder to monitor MCP servers.';
    case 'no_config':
      return 'Add MCP config: .vscode/mcp.json or .cursor/mcp.json (workspace), or globals ~/.cursor/mcp.json, VS Code User mcp.json, Windsurf, Claude Code (~/.claude.json).';
    case 'empty_servers':
      return 'mcp.json found but no valid servers. Use a "servers" or "mcpServers" object with stdio (command), http (url), or sse (url) entries.';
    case 'untrusted':
      return 'Approval required before MCP Watchdog connects to your MCP servers. Run "Review Trusted Servers" or click the status bar.';
    default:
      return '';
  }
}
